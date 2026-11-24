import { test, expect, type Page, type Route } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';
import { tree } from './bubble-mocks';

// NOTICE-NEWS-FEEDS-2500 evidence: הגדרות › לוח הודעות › מקורות חדשות shows a small "not working" chip (with the reason) on a source whose
// last fetch failed; a source that works, or that no board fetched yet, has none; an edited (unsaved) address is not judged by the old
// one's result. Hebrew and English, desktop and phone, light and dark. Real build, fake data.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-notice-news-feeds-2500.spec.ts --project=desktop --project=mobile
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/notice-news-feeds-2500');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = '2026-11-24T06:12:00Z';
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const SOURCES = [
  { id: 'ynet', name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', enabled: true, has_logo: false, logo_url: '', custom: false, last_ok_at: ago(4), last_error: null },
  { id: 'globes', name: 'גלובס', url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2', enabled: true, has_logo: false, logo_url: '', custom: false, last_ok_at: ago(9), last_error: null },
  { id: 'calcalist', name: 'כלכליסט', url: 'https://www.calcalist.co.il/Integration/StoryRss3674.xml', enabled: true, has_logo: false, logo_url: '', custom: false, last_ok_at: null, last_error: 'status' },
  { id: 'walla', name: 'וואלה', url: 'https://rss.walla.co.il/feed/1', enabled: true, has_logo: false, logo_url: '', custom: false, last_ok_at: ago(130), last_error: 'xml' },
  { id: 'snew', name: 'מקור שלא נבדק', url: 'https://feeds.example.com/rss', enabled: true, has_logo: false, logo_url: '', custom: false, last_ok_at: null, last_error: null },
];
const SETTINGS = {
  enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, home_empty: 'hide', show_places_tree: true, boards_remote: false,
  boards_max: 10, weather_entity: '', weather_fallback: false, news_custom: false, building_name: '', boards_origin: '', news_sources: SOURCES,
};

async function install(page: Page, lang: 'he' | 'en' = 'he'): Promise<void> {
  const can = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true, delete: true };
  await installGeneratorMock(page, { perms: ['devices.read', 'notices.view', 'notices.manage', 'notices.boards', 'system.configure', 'notices.delete'], count: 0,
    modules: { tickets: false, notices: true } as { tickets: boolean } });
  if (lang === 'en') {
    await page.addInitScript(() => { try { localStorage.setItem('sw.ui.lang', 'en'); } catch { /* about:blank has no storage */ } });
    await page.route('**/api/v1/me/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }) }));
  }
  await page.route('**/api/v1/notices**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'notices/module') return json(route, { enabled: true, can });
    if (p === 'notices' && req.method() === 'GET') return json(route, { notices: [], can, now: NOW, defaults: { default_days: 7, default_severity: 'info', home_empty: 'hide', show_places_tree: true } });
    if (p === 'notices/settings') return json(route, { settings: SETTINGS, can, weather_entities: [], company_logo: false, listener: false, building_fallback: '' });
    if (p === 'notices/news-sources') return json(route, { sources: SOURCES, max: 12, name_max: 40 });
    if (p === 'notices/boards' && req.method() === 'GET') return json(route, { boards: [], full: true, max: 10, remote: false });
    if (p === 'notices/audience/options') return json(route, { floors: [], areas: [], groups: [], roles: [] });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  await page.route('**/api/v1/devices/tree', (route) => json(route, tree()));
}

const card = (page: Page) => page.locator('sw-app notice-news-sources [data-news-sources-card]');
const row = (page: Page, id: string) => card(page).locator(`[data-ns-row="${id}"]`);

async function open(page: Page, scheme: 'light' | 'dark' = 'light', lang: 'he' | 'en' = 'he'): Promise<void> {
  await install(page, lang);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(url('/system/notices', 'classic', scheme));
  await expect(card(page)).toBeVisible({ timeout: 20_000 });
  if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
}

test('a failing source shows "not working" with the reason; a working or never-fetched one shows nothing', async ({ page }) => {
  await open(page);
  await expect(row(page, 'walla').locator('[data-ns-health="xml"]')).toHaveText(/לא עובד · לא פיד RSS תקין/);
  await expect(row(page, 'calcalist').locator('[data-ns-health="status"]')).toHaveText(/לא עובד · שגיאת שרת/);
  await expect(row(page, 'calcalist').locator('[data-ns-health]')).toHaveAttribute('title', /לא עבד מאז הפעלת המערכת/);
  await expect(row(page, 'walla').locator('[data-ns-health]')).toHaveAttribute('title', /עבד לאחרונה/);
  for (const id of ['ynet', 'globes', 'snew']) await expect(row(page, id).locator('[data-ns-health]')).toHaveCount(0);
  // the chip stays inside its row (phone: the tools wrap under the address)
  const r = await row(page, 'walla').boundingBox();
  const c = await row(page, 'walla').locator('[data-ns-health]').boundingBox();
  expect(r && c).toBeTruthy();
  expect(c!.x).toBeGreaterThanOrEqual(r!.x - 1);
  expect(c!.x + c!.width).toBeLessThanOrEqual(r!.x + r!.width + 1);
});

test('an edited address is not judged by the old result: the chip leaves while the row is unsaved', async ({ page }) => {
  await open(page);
  const url2 = row(page, 'calcalist').locator('[data-ns-url]');
  await url2.fill('https://www.calcalist.co.il/Integration/StoryRss2.xml');
  await expect(row(page, 'calcalist').locator('[data-ns-health]')).toHaveCount(0);
  await card(page).locator('[data-ns-discard]').click();
  await expect(row(page, 'calcalist').locator('[data-ns-health="status"]')).toBeVisible();
});

test('English: the chip and its reason are English', async ({ page }) => {
  await open(page, 'light', 'en');
  await expect(row(page, 'walla').locator('[data-ns-health="xml"]')).toHaveText(/Not working · Not a valid RSS feed/);
  await expect(row(page, 'calcalist').locator('[data-ns-health="status"]')).toHaveText(/Not working · Server error/);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`shot: the sources card (${scheme})`, async ({ page }) => {
    await open(page, scheme);
    await card(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await card(page).screenshot({ path: path.join(OUT, `sources-${scheme}-${test.info().project.name}.png`) });
  });
}
