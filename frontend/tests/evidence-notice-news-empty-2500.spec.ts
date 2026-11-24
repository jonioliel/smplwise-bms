import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';
import { display, lobbyFeed } from './notice-tv-fixtures';

// NOTICE-NEWS-EMPTY-2500 evidence: a board with the news block on and no source chosen shows no news on the TV, silently (the lab's
// "כניסה ראשית" on 23.11). The REAL build against fake data: the board editor warns under the news switch with "הוספת כל המקורות" (the
// list's enabled sources, at most 6), removing the LAST source while news is on asks first, and the boards table / phone card / board line
// carry a warning chip. Every call is recorded.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-notice-news-empty-2500.spec.ts
// SHOT_LABEL=before|after (default after) only names the screenshot folder of the compare page's "shots" test.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/news-empty-2500');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = '2026-11-24T06:12:00Z';
const CAN = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true };
const SOURCES = [
  { id: 'ynet', name: 'ynet', url: 'https://www.ynet.co.il/Integration/StoryRss2.xml', enabled: true, has_logo: false, logo_url: '', custom: false },
  { id: 'globes', name: 'גלובס', url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2', enabled: true, has_logo: false, logo_url: '', custom: false },
  { id: 'calcalist', name: 'כלכליסט', url: 'https://www.calcalist.co.il/GeneralRSS/0,16335,L-8,00.xml', enabled: false, has_logo: false, logo_url: '', custom: false },
  { id: 'walla', name: 'וואלה', url: 'https://rss.walla.co.il/feed/1', enabled: true, has_logo: false, logo_url: '', custom: false },
  { id: 'c1a2b3c4d', name: 'example', url: 'https://news.example.org/rss.xml', enabled: true, has_logo: false, logo_url: '', custom: true },
];
const SETTINGS = {
  enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, boards_remote: false, boards_max: 10,
  weather_entity: '', weather_fallback: false, news_custom: false, building_name: '', boards_origin: '', news_sources: SOURCES,
};
const YNET = { id: 'ynet', name: 'ynet', url: SOURCES[0].url };
const UNSET = display({ news: { feeds: [], speed: 'normal' } });
const board = (id: string, slug: string, name: string, d = UNSET, unset?: boolean) => ({
  id, name, slug, enabled: true, display: d, has_token: true, has_stored_link: true, token_rotated_at: '2026-11-01T08:00:00Z', last_seen_at: '2026-11-24T06:11:40Z',
  item_count: 0, created_at: '2026-11-01T08:00:00Z', updated_at: NOW, ...(unset === undefined ? {} : { news_unset: unset }),
});

type Call = { method: string; path: string; body: unknown };

async function install(page: Page, d = UNSET, scheme: 'light' | 'dark' = 'light', hash = '/system/notices/b1'): Promise<Call[]> {
  await page.clock.setFixedTime(new Date(NOW));
  await installGeneratorMock(page, { perms: ['devices.read', 'notices.view', 'notices.manage', 'notices.push', 'notices.boards', 'system.configure'], count: 0,
    modules: { tickets: false, notices: true } as { tickets: boolean } });
  const unset = !!d.blocks.news && !d.news.feeds.length;
  const boards = [board('b1', 'main', 'כניסה ראשית', d, unset), board('b2', 'lobby', 'לובי', display())]; // b2: an older server's answer (no flag)
  const calls: Call[] = [];
  await page.route('**/api/v1/notices**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    let body: unknown = null;
    try { body = method === 'GET' ? null : req.postDataJSON(); } catch { body = null; }
    calls.push({ method, path: p, body });
    if (p === 'notices/module') return json(route, { enabled: true, can: CAN });
    if (p === 'notices/settings' && method === 'GET') return json(route, { settings: SETTINGS, can: CAN, weather_entities: [], company_logo: false, listener: true, building_fallback: 'מגדל הים' });
    if (p === 'notices' && method === 'GET') return json(route, { notices: [], can: CAN, now: NOW, defaults: { default_days: 7, default_severity: 'info', push_default: 'by_severity' } });
    if (p === 'notices/boards' && method === 'GET') return json(route, { boards, full: true, max: 10, remote: false });
    if (p === 'notices/boards/b1' && method === 'GET') return json(route, { board: boards[0], notices: [] });
    if (p === 'notices/boards/b1' && method === 'PATCH') {
      const nd = { ...boards[0].display, ...((body as { display?: object }).display ?? {}) } as typeof d;
      return json(route, { board: { ...boards[0], display: nd, news_unset: !!nd.blocks.news && !nd.news.feeds.length } });
    }
    if (p.startsWith('notices/boards/b1/preview')) return json(route, { ...lobbyFeed({ news: d.news, blocks: d.blocks }), news_unset: unset });
    if (p === 'notices/audience/options') return json(route, { floors: [], groups: [], roles: [] });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
  return calls;
}

const root = (page: Page) => page.locator('sw-app system-notices');
const openDisplay = async (page: Page) => {
  await root(page).locator('sw-tabs').getByText('תצוגה').click();
  await expect(root(page).locator('[data-save-display]')).toBeVisible();
};
const NEWS_TOGGLE = 'sw-toggle[label="חדשות (כותרות)"]';
const newsBlk = (page: Page) => root(page).locator('.blk').filter({ has: page.locator(NEWS_TOGGLE) });
const lastPatch = (calls: Call[]) => (calls.filter((c) => c.method === 'PATCH' && c.path === 'notices/boards/b1').at(-1)?.body as { display?: { news?: { feeds?: { id?: string }[] }; blocks?: { news?: boolean } } } | undefined)?.display;

async function shot(page: Page, name: string, label = 'after'): Promise<void> {
  const dir = path.join(OUT, label);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}.png`) });
}

test('overview: a board with news on and no source carries the warning chip; a board with a source does not', async ({ page }) => {
  await install(page, UNSET, 'light', '/system/notices');
  const r = root(page);
  if (test.info().project.name === 'mobile') {
    await expect(r.locator('[data-board-card="main"] [data-news-unset-chip]')).toHaveText('חדשות ללא מקור');
    await expect(r.locator('[data-board-card="lobby"] [data-news-unset-chip]')).toHaveCount(0);
  } else {
    await expect(r.locator('tr[data-board="main"] [data-news-unset-chip]')).toHaveText('חדשות ללא מקור');
    await expect(r.locator('tr[data-board="main"] [data-news-unset-chip]')).toHaveAttribute('data-tone', 'warn');
    await expect(r.locator('tr[data-board="lobby"] [data-news-unset-chip]')).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('editor: the warning under the news switch, "הוספת כל המקורות" adds the enabled list sources, and the save sends them', async ({ page }) => {
  const calls = await install(page);
  await expect(root(page).locator('.top [data-news-unset-chip]')).toBeVisible(); // the board line
  await openDisplay(page);
  const warn = newsBlk(page).locator('[data-news-unset]');
  await expect(warn).toContainText('החדשות מופעלות אבל לא נבחר מקור - לא יוצגו חדשות במסך');
  await warn.locator('[data-news-add-all]').click();
  await expect(warn).toHaveCount(0);
  // the enabled list sources in the list's order: a disabled source and a board-stored raw URL ("custom") are not added
  await expect(newsBlk(page).locator('[data-feed]')).toHaveCount(3);
  await root(page).locator('[data-save-display]').click();
  await expect.poll(() => lastPatch(calls)?.news?.feeds?.map((f) => f.id)).toEqual(['ynet', 'globes', 'walla']);
  expect(lastPatch(calls)?.blocks?.news).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('editor: switching news off clears the warning; switching it on with no source shows it again', async ({ page }) => {
  await install(page);
  await openDisplay(page);
  const warn = newsBlk(page).locator('[data-news-unset]');
  await expect(warn).toBeVisible();
  await newsBlk(page).locator(NEWS_TOGGLE).click();
  await expect(warn).toHaveCount(0);
  await newsBlk(page).locator(NEWS_TOGGLE).click();
  await expect(warn).toBeVisible();
});

test('editor: removing the LAST source while news is on asks first; cancel keeps it, confirm removes it and the warning appears', async ({ page }) => {
  const calls = await install(page, display({ news: { feeds: [YNET], speed: 'normal' } }));
  await expect(root(page).locator('.top [data-news-unset-chip]')).toHaveCount(0);
  await openDisplay(page);
  const dlg = root(page).locator('[data-news-last-confirm]');
  await newsBlk(page).locator('[data-feed-remove]').click();
  await expect(dlg).toHaveAttribute('open', '');
  await expect(dlg).toHaveAttribute('heading', 'להסיר את המקור האחרון?');
  await expect(dlg).toContainText('בלי מקור לא יוצגו חדשות במסך');
  await dlg.locator('[data-news-last-cancel]').click();
  await expect(dlg).not.toHaveAttribute('open', '');
  await expect(newsBlk(page).locator('[data-feed]')).toHaveCount(1);
  await newsBlk(page).locator('[data-feed-remove]').click();
  await dlg.locator('[data-news-last-go]').click();
  await expect(newsBlk(page).locator('[data-feed]')).toHaveCount(0);
  await expect(newsBlk(page).locator('[data-news-unset]')).toBeVisible();
  await root(page).locator('[data-save-display]').click();
  await expect.poll(() => lastPatch(calls)?.news?.feeds).toEqual([]);
  await expect(root(page).locator('.top [data-news-unset-chip]')).toBeVisible(); // the saved board now says it
});

test('editor: with news off the last source goes without a question, and with two sources the first goes without one', async ({ page }) => {
  await install(page, display({ blocks: { ...display().blocks, news: false }, news: { feeds: [YNET], speed: 'normal' } }));
  await openDisplay(page);
  await newsBlk(page).locator('[data-feed-remove]').click();
  await expect(root(page).locator('[data-news-last-confirm]')).not.toHaveAttribute('open', '');
  await expect(newsBlk(page).locator('[data-feed]')).toHaveCount(0);
  await expect(newsBlk(page).locator('[data-news-unset]')).toHaveCount(0); // news off: nothing to warn about
});

test('editor: two sources - removing one does not ask', async ({ page }) => {
  await install(page, display({ news: { feeds: [YNET, { id: 'globes', name: 'גלובס', url: SOURCES[1].url }], speed: 'normal' } }));
  await openDisplay(page);
  await newsBlk(page).locator('[data-feed-remove]').first().click();
  await expect(root(page).locator('[data-news-last-confirm]')).not.toHaveAttribute('open', '');
  await expect(newsBlk(page).locator('[data-feed]')).toHaveCount(1);
});

// the compare page's screenshots (before = the base build, after = this branch): only the generic page is asserted, so the same test
// runs on a build without the change
for (const scheme of ['light', 'dark'] as const) {
  test(`shots ${scheme}`, async ({ page }) => {
    test.skip(test.info().project.name === 'tablet', 'desktop + phone only');
    const label = process.env.SHOT_LABEL || 'after';
    await install(page, UNSET, scheme, '/system/notices');
    await expect(root(page).locator('[data-boards-card]')).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, `boards-${scheme}`, label);
    await page.goto('about:blank');
    await page.goto(url('/system/notices/b1', 'classic', scheme));
    await openDisplay(page);
    await newsBlk(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await newsBlk(page).screenshot({ path: path.join(OUT, label, `news-block-${scheme}-${test.info().project.name}.png`) });
    await shot(page, `board-display-${scheme}`, label);
  });
}
