import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';
import { tree } from './bubble-mocks';

// NOTICEPAGE-295 evidence: the places tree and the "מי קרא" sheet of ראשי › לוח הודעות (#/devices/notices) and the home widget, from the REAL
// build against fake data (the generator mock serves the session; the notices routes are layered on top). Screenshots: test-results/noticepage/.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-noticepage-295.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/noticepage');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = '2026-10-24T06:12:00Z';
const CAN = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true };

const mk = (id: string, title: string, o: Record<string, unknown> = {}) => ({
  id, title, body: 'שורה ראשונה של ' + title, severity: 'info', starts_at: '2026-10-24T05:30:00Z', ends_at: '2026-10-27T09:00:00Z', pinned: false, state: 'active', dwell_s: null,
  when_text: null, published_at: '2026-10-24T05:40:00Z', updated_at: NOW, boards: [], read: true, audience: { everyone: true }, status: 'published', reads: 3, ...o,
});
const NOTICES = [
  mk('n1', 'הפסקת מים מחר 10:00-12:00', { severity: 'critical', read: false, reads: 84 }),
  mk('n2', 'טיפול במעלית הצפונית', { severity: 'alert', audience: { floors: ['f1'] }, read: false, reads: 51 }),
  mk('n3', 'שטיפת הלובי', { audience: { areas: ['z1'] }, reads: 9 }),
  mk('n4', 'חדר הכושר סגור לשיפוץ', { audience: { floors: ['f2'] }, reads: 5 }),
  mk('n5', 'שינוי שעות קבלת קהל', { state: 'draft', status: 'draft', reads: 0, audience: { everyone: true } }),
];
const FLOORS = [{ id: 'f1', name: 'קומה 1', building: 'מבנה א' }, { id: 'f2', name: 'קומה 2', building: 'מבנה א' }];
const AREAS = [{ id: 'z1', name: 'לובי', floor: 'f1' }];
const READS = {
  audience: 118, read: 84,
  users: [{ user_id: 'u1', name: 'דני כהן', place: '', read_at: '2026-10-24T05:41:00Z' }, { user_id: 'u2', name: 'רונית לוי', place: 'קומה 2', read_at: '2026-10-24T05:52:00Z' }],
  unread: [{ user_id: 'u3', name: 'אבי שמעוני', place: 'ועד הבית' }],
};

async function install(page: Page, o: { enabled?: boolean; manager?: boolean; names?: boolean; empty?: boolean; homeEmpty?: 'hide' | 'line'; cards?: boolean } = {}): Promise<string[]> {
  const enabled = o.enabled ?? true;
  const manager = o.manager ?? true;
  const perms = manager ? ['devices.read', 'notices.view', 'notices.manage', 'notices.push', 'notices.boards', 'system.configure'] : ['devices.read', 'notices.view'];
  await installGeneratorMock(page, { perms, count: 0, modules: { tickets: false, notices: enabled } as { tickets: boolean } });
  const calls: string[] = [];
  await page.route('**/api/v1/notices**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    calls.push(`${req.method()} ${p}${new URL(req.url()).search}`);
    if (p === 'notices/module') return json(route, { enabled, can: CAN });
    if (!enabled) return json(route, { code: 'feature_disabled', user_message: 'כבוי', retryable: false, correlation_id: 'mock', details: {} }, 404);
    if (p === 'notices' && req.method() === 'GET') {
      const scope = new URL(req.url()).searchParams.get('scope');
      if (scope === 'all' && !manager) return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'mock', details: {} }, 403);
      const list = o.empty ? [] : scope === 'all' ? NOTICES : NOTICES.filter((n) => n.state === 'active').map(({ audience: _a, status: _s, reads: _r, ...n }) => n);
      return json(route, { notices: list, can: CAN, now: NOW, defaults: { default_days: 7, default_severity: 'info', home_empty: o.homeEmpty ?? 'hide' } });
    }
    if (p === 'notices/settings') return json(route, req.method() === 'GET' ? { settings: { ...SETTINGS, home_empty: o.homeEmpty ?? 'hide' }, can: CAN, weather_entities: [], company_logo: false, listener: false, building_fallback: '' } : { settings: SETTINGS });
    if (p === 'notices/boards' && req.method() === 'GET') return json(route, { boards: [], full: false, max: 10, remote: false });
    if (p === 'notices/audience/options') return json(route, { floors: FLOORS, areas: AREAS, groups: [], roles: [] });
    if (p === 'notices/n1/reads') return json(route, o.names === false ? { audience: 118, read: 84 } : READS);
    if (p === 'notices/n2/reads') return json(route, { code: 'forbidden', user_message: 'אין הרשאה', retryable: false, correlation_id: 'mock', details: {} }, 403);
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  // the home screen: the tree answer carries the widget configuration (a later page.route wins over the mock's empty tree)
  const home = { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: false, config: { notices: { on: true } }, data: {} };
  await page.route('**/api/v1/devices/tree', (route) => json(route, { ...tree(), home }));
  // POLISH-295: the clock / weather / Shabbat / alarm cards moved into the thin header bar by default; the specs that wait for a
  // widget card to know the home grid rendered pin the large cards (home.info_style = cards), as the other card-reading specs do
  if (o.cards) {
    await page.route((u) => u.pathname.endsWith('/api/v1/settings'), (route) => json(route, { settings: { 'ui.design': 'a', 'home.info_style': 'cards' }, can_edit: false }));
  }
  return calls;
}

async function noOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

const W = 'sw-app devices-building home-widgets';
const SETTINGS = {
  enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, home_empty: 'hide', boards_remote: false, boards_max: 10,
  weather_entity: '', weather_fallback: false, news_custom: false, building_name: '', boards_origin: '', news_sources: [],
};
const phone = () => test.info().project.name === 'mobile';
const titles = (page: Page) => page.locator('sw-app devices-notices').locator(phone() ? '.card .t1' : 'table.t tbody .t1').allTextContents();

test('places tree: counts, a floor filters the list, an area counts for its floor, folding hides the area', async ({ page }) => {
  await install(page);
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  if (phone()) {
    // the phone: no tree, one select with the same places
    await expect(root.locator('notice-places')).toBeHidden();
    const sel = root.locator('[data-place-select]');
    await expect(sel).toBeVisible();
    await sel.selectOption('f:f2');
    expect(await titles(page)).toEqual(['חדר הכושר סגור לשיפוץ']);
    await noOverflow(page);
    await shot(page, 'places-select');
    return;
  }
  const tree = root.locator('notice-places');
  await expect(tree).toBeVisible();
  await expect(tree.locator('[data-place="all"] .n')).toHaveText('5');
  await expect(tree.locator('[data-place="f:f1"] .n')).toHaveText('2'); // the floor's own notice and the area's
  await expect(tree.locator('[data-place="a:z1"] .n')).toHaveText('1');
  await expect(tree.locator('[data-place="f:f2"] .n')).toHaveText('1');
  expect(await titles(page)).toHaveLength(5);
  await tree.locator('[data-place="f:f1"]').click();
  expect(await titles(page)).toEqual(['טיפול במעלית הצפונית', 'שטיפת הלובי']);
  await expect(tree.locator('[data-place="f:f1"]')).toHaveAttribute('aria-current', 'true');
  await tree.locator('[data-place="a:z1"]').click();
  expect(await titles(page)).toEqual(['שטיפת הלובי']);
  await tree.locator('[data-place-fold="f:f1"]').click();
  await expect(tree.locator('[data-place="a:z1"]')).toHaveCount(0);
  await shot(page, 'places-tree');
  await tree.locator('[data-place="all"]').click();
  expect(await titles(page)).toHaveLength(5);
  await noOverflow(page);
  // control screen: the page does not grow a scrollbar of its own because of the tree
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2)).toBe(true);
});

test('places tree: a reader sees none (the audience of a notice is for managers)', async ({ page }) => {
  await install(page, { manager: false });
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  await expect(root.locator('[data-kpis] .kpi').first()).toBeVisible();
  await expect(root.locator('notice-places')).toHaveCount(0);
  await expect(root.locator('[data-place-select]')).toHaveCount(0);
  await expect(root.locator('[data-reads]')).toHaveCount(0);
});

test('מי קרא: the count opens the sheet with the counts, the progress and the two lists', async ({ page }) => {
  const calls = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  const btn = root.locator('[data-reads="n1"]:visible').first();
  await btn.click();
  const sheet = root.locator('notice-reads');
  await expect(sheet.locator('[data-reads-read]')).toHaveText('2');
  await expect(sheet.locator('[data-reads-unread]')).toHaveText('1');
  await expect(sheet.locator('[data-reads-total]')).toHaveText('3');
  await expect(sheet.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '67');
  expect(calls).toContain('GET notices/n1/reads');
  const rows = sheet.locator('[data-reads-row]');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('רונית לוי'); // newest first
  await expect(rows.first()).toContainText('קומה 2');
  await expect(rows.first()).toContainText('24.10 08:52');
  await expect(rows.nth(1).locator('[data-reads-place]')).toHaveText('כל הבניין'); // no floor binding
  await shot(page, 'reads-read');
  await sheet.locator('[data-seg="unread"]').click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('אבי שמעוני');
  await expect(rows.first()).toContainText('ועד הבית');
  await shot(page, 'reads-unread');
  await sheet.locator('sw-button[slot="footer"]').click();
  await expect(sheet.locator('[data-reads-body]')).toHaveCount(0);
  // the row did not open the compose dialog
  await expect(root.locator('[data-compose-dialog]')).toBeHidden();
});

test('מי קרא: with the names switched off the sheet shows the counts only', async ({ page }) => {
  await install(page, { names: false });
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  await root.locator('[data-reads="n1"]:visible').first().click();
  const sheet = root.locator('notice-reads');
  await expect(sheet.locator('[data-reads-read]')).toHaveText('84');
  await expect(sheet.locator('[data-reads-unread]')).toHaveText('34');
  await expect(sheet.locator('[data-reads-total]')).toHaveText('118');
  await expect(sheet.locator('[data-reads-seg]')).toHaveCount(0);
  await expect(sheet.locator('[data-reads-table]')).toHaveCount(0);
});

test('מי קרא: a refused answer shows the error panel with a retry; a draft has no button', async ({ page }) => {
  await install(page);
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  await root.locator('[data-reads="n2"]:visible').first().click();
  await expect(root.locator('notice-reads sw-state-panel[state="error"]')).toBeVisible();
  await expect(root.locator('[data-reads="n5"]')).toHaveCount(0);
});

test('home widget: up to three notices, urgent first, an unread dot, the link to the page', async ({ page }) => {
  await install(page);
  await page.goto('about:blank');
  await page.goto(url('/devices/building'));
  const w = page.locator(`${W} [data-home-notices-list]`);
  await expect(w).toBeAttached({ timeout: 30_000 });
  await w.scrollIntoViewIfNeeded();
  const rows = w.locator('[data-home-notice]');
  await expect(rows).toHaveCount(3);
  expect(await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.homeNotice))).toEqual(['n1', 'n2', 'n3']);
  await expect(rows.first()).toHaveAttribute('data-unread', 'true');
  await expect(rows.nth(2)).toHaveAttribute('data-unread', 'false');
  await expect(rows.first()).toContainText('דחוף · עד 27.10');
  await expect(page.locator(`${W} [data-home-notices-all]`)).toHaveAttribute('href', '#/devices/notices');
  await noOverflow(page);
  await shot(page, 'home-widget');
});

test('home widget: absent while the module is off', async ({ page }) => {
  const calls = await install(page, { enabled: false, cards: true });
  await page.goto('about:blank');
  await page.goto(url('/devices/building'));
  await expect(page.locator(`${W} [data-home-widget]`).first()).toBeAttached({ timeout: 30_000 });
  await expect(page.locator(`${W} [data-home-notices-list], ${W} [data-home-notices-none]`)).toHaveCount(0);
  expect(calls.filter((c) => c.startsWith('GET notices?'))).toEqual([]); // not even a request
});

test('home widget: no active notice - hidden by default, one line when the board setting asks for it', async ({ page }) => {
  await install(page, { empty: true, cards: true });
  await page.goto('about:blank');
  await page.goto(url('/devices/building'));
  await expect(page.locator(`${W} [data-home-widget]`).first()).toBeAttached({ timeout: 30_000 });
  await expect(page.locator(`${W} [data-home-notices-list], ${W} [data-home-notices-none]`)).toHaveCount(0);
});

test('home widget: the board setting "line" shows the single "no active notices" line', async ({ page }) => {
  await install(page, { empty: true, homeEmpty: 'line' });
  await page.goto('about:blank');
  await page.goto(url('/devices/building'));
  const none = page.locator(`${W} [data-home-notices-none]`);
  await expect(none).toBeAttached({ timeout: 30_000 });
  await expect(none).toContainText('אין הודעות פעילות');
  await expect(page.locator(`${W} [data-home-notices-list]`)).toHaveCount(0);
});

test('settings: the home-widget empty setting is a choice that saves home_empty', async ({ page }) => {
  await install(page);
  const bodies: unknown[] = [];
  page.on('request', (r) => { if (r.method() === 'PATCH' && r.url().includes('/notices/settings')) bodies.push(r.postDataJSON()); });
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const sel = page.locator('sw-app system-notices notice-home-empty select[data-home-empty]');
  await expect(sel).toBeVisible({ timeout: 30_000 });
  await expect(sel).toHaveValue('hide');
  await sel.selectOption('line');
  await expect.poll(() => bodies).toEqual([{ home_empty: 'line' }]);
});
