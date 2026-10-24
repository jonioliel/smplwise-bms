import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';
import { lobbyFeed } from './notice-tv-fixtures';

// NOTICESLIDES-295 evidence: the slides grid, the slide dialog and the building photo in הגדרות › לוח הודעות › לוח › תצוגה, from the REAL
// build against fake data (the generator mock layer serves the session; the notices routes are layered on top).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-noticeslides-295.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/notices');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = '2026-10-23T06:12:00Z';
const CAN = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true };
const SETTINGS = {
  enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, boards_remote: false, boards_max: 10,
  weather_entity: '', weather_fallback: false, news_custom: false, building_name: '', boards_origin: '', news_sources: [],
};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP8z8Dwn4GBgYEBAAsfAgGJmhWvAAAAAElFTkSuQmCC', 'base64');
const board = (template = 1) => ({ id: 'b1', name: 'לוח הלובי', slug: 'lobby', enabled: true, display: lobbyFeed({ template: template as 1 | 2 }).board.display, has_token: true, token_rotated_at: NOW,
  last_seen_at: NOW, item_count: 0, created_at: NOW, updated_at: NOW });
const BOARD2 = { ...board(), id: 'b2', name: 'לוח חדר הכושר', slug: 'gym' };

interface Call { method: string; path: string; body: unknown }

async function install(page: Page, o: { template?: number; slides?: number } = {}): Promise<Call[]> {
  await installGeneratorMock(page, { perms: ['devices.read', 'notices.view', 'notices.manage', 'notices.boards', 'system.configure'], count: 0, modules: { tickets: false, notices: true } as { tickets: boolean } });
  const calls: Call[] = [];
  const slides = Array.from({ length: o.slides ?? 2 }, (_x, i) => ({ id: 's' + (i + 1), title: i === 0 ? 'חדר הכושר פתוח' : 'אפליקציית הבניין', text: 'טקסט', seconds: i === 0 ? 20 : null, has_image: i === 1, stamp: 'st' + i, boards: ['b1'] }));
  let photo = false;
  const doc = () => ({ slides, limit: 10, seconds: { min: 6, max: 120 }, photo: { has: photo, stamp: photo ? 'ph1' : '' } });
  await page.route('**/api/v1/notices**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    let body: unknown = null;
    try { body = method === 'GET' || method === 'DELETE' ? null : req.postDataJSON(); } catch { body = '(multipart)'; }
    calls.push({ method, path: p, body });
    if (p === 'notices/module') return json(route, { enabled: true, can: CAN });
    if (p === 'notices/settings' && method === 'GET') return json(route, { settings: SETTINGS, can: CAN, weather_entities: [], company_logo: false, listener: false, building_fallback: '' });
    if (p === 'notices' && method === 'GET') return json(route, { notices: [], can: CAN, now: NOW, defaults: { default_days: 7, default_severity: 'info' } });
    if (p === 'notices/boards' && method === 'GET') return json(route, { boards: [board(o.template), BOARD2], full: false, max: 10, remote: false });
    if (p === 'notices/boards/b1' && method === 'GET') return json(route, { board: board(o.template), notices: [] });
    if (p === 'notices/boards/b1' && method === 'PATCH') return json(route, { board: board(o.template) });
    if (p === 'notices/boards/b1/preview') return json(route, lobbyFeed(((body as { display?: object } | null)?.display ?? {}) as never));
    if (p === 'notices/boards/b1/slides') return json(route, doc());
    if (p === 'notices/promo-slides' && method === 'POST') { slides.push({ id: 's9', title: (body as { title: string }).title, text: '', seconds: null, has_image: false, stamp: '', boards: (body as { board_ids: string[] }).board_ids }); return json(route, { id: 's9', ...doc() }); }
    if (/^notices\/promo-slides\/s\d$/.test(p) && method === 'PATCH') return json(route, doc());
    if (/^notices\/promo-slides\/s\d$/.test(p) && method === 'DELETE') { slides.splice(slides.findIndex((s) => s.id === p.split('/')[2]), 1); return json(route, doc()); }
    if (/^notices\/promo-slides\/s\d\/image$/.test(p) && method === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (/^notices\/promo-slides\/s\d\/image$/.test(p)) return json(route, doc());
    if (p === 'notices/boards/b1/photo' && method === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (p === 'notices/boards/b1/photo' && method === 'PUT') { photo = true; return json(route, doc()); }
    if (p === 'notices/boards/b1/photo' && method === 'DELETE') { photo = false; return json(route, doc()); }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  return calls;
}

async function openDisplay(page: Page) {
  await page.goto('about:blank');
  await page.goto(url('/system/notices/b1'));
  const root = page.locator('sw-app system-notices');
  await root.locator('sw-tabs').getByText('תצוגה').click();
  return root;
}

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}

test('the slides grid shows each slide with edit, the count and the seconds, and "שקופית חדשה"', async ({ page }) => {
  await install(page);
  const root = await openDisplay(page);
  const sl = root.locator('notice-display-slides');
  await expect(sl.locator('[data-slide]')).toHaveCount(2);
  await expect(sl.locator('[data-slides-count]')).toHaveText('2 שקופיות · 32 שניות'); // 20 s + the board's 12 s
  await expect(sl.locator('[data-slide="s1"] b')).toHaveText('חדר הכושר פתוח');
  await expect(sl.locator('[data-slide="s2"] img')).toHaveCount(1);
  await expect(sl.locator('[data-slide-new]')).toBeEnabled();
  await expect(sl.locator('[data-photo-block]')).toHaveCount(0); // template 1: no photo control
  // a clean operator screen: no paragraph or hint was added by this block
  await expect(sl.locator('p')).toHaveCount(0);
  await sl.scrollIntoViewIfNeeded();
  fs.mkdirSync(OUT, { recursive: true });
  await sl.screenshot({ path: path.join(OUT, `display-slides-block-${test.info().project.name}.png`) });
});

test('the promo switch is part of the display draft and is saved with it', async ({ page }) => {
  const calls = await install(page);
  const root = await openDisplay(page);
  await root.locator('notice-display-slides [data-promo]').check();
  await root.locator('[data-save-display]').click();
  await expect.poll(() => (calls.find((c) => c.method === 'PATCH' && c.path === 'notices/boards/b1')?.body as { display?: { blocks?: { promo?: boolean } } } | undefined)?.display?.blocks?.promo).toBe(true);
});

test('a new slide: title, seconds, a picture and the boards that show it; it is created, then the picture is uploaded', async ({ page }) => {
  const calls = await install(page);
  const root = await openDisplay(page);
  const sl = root.locator('notice-display-slides');
  await sl.locator('[data-slide-new]').click();
  await expect(sl.locator('[data-slide-save]')).toHaveAttribute('disabled', ''); // no title yet
  await sl.locator('#sl-title').fill('שוק איכרים בכניסה');
  await sl.locator('#sl-sec').fill('25');
  await sl.locator('[data-slide-file]').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
  await sl.locator('[data-slide-board="b2"]').click();
  await shot(page, 'display-slide-dialog');
  await sl.locator('[data-slide-save]').click();
  await expect.poll(() => calls.some((c) => c.method === 'PUT' && c.path === 'notices/promo-slides/s9/image')).toBe(true);
  const created = calls.find((c) => c.method === 'POST' && c.path === 'notices/promo-slides')?.body as { title: string; seconds: number; board_ids: string[] };
  expect(created).toMatchObject({ title: 'שוק איכרים בכניסה', seconds: 25 });
  expect(created.board_ids.sort()).toEqual(['b1', 'b2']);
  await expect(sl.locator('[data-slide-dialog]')).toHaveCount(0);
});

test('edit and delete (second click confirms) a slide', async ({ page }) => {
  const calls = await install(page);
  const root = await openDisplay(page);
  const sl = root.locator('notice-display-slides');
  await sl.locator('[data-slide="s1"] [data-slide-edit]').click();
  await expect(sl.locator('#sl-title')).toHaveValue('חדר הכושר פתוח');
  await expect(sl.locator('#sl-sec')).toHaveValue('20');
  await sl.locator('#sl-title').fill('חדר הכושר סגור');
  await sl.locator('[data-slide-save]').click();
  await expect.poll(() => calls.find((c) => c.method === 'PATCH' && c.path === 'notices/promo-slides/s1')?.body).toMatchObject({ title: 'חדר הכושר סגור', seconds: 20 });
  await sl.locator('[data-slide="s2"] [data-slide-edit]').click();
  await sl.locator('[data-slide-delete]').click();
  expect(calls.some((c) => c.method === 'DELETE' && c.path === 'notices/promo-slides/s2')).toBe(false); // the first click only asks
  await sl.locator('[data-slide-delete]').click();
  await expect.poll(() => calls.some((c) => c.method === 'DELETE' && c.path === 'notices/promo-slides/s2')).toBe(true);
});

test('ten slides fill the board: no more can be added', async ({ page }) => {
  await install(page, { slides: 10 });
  const root = await openDisplay(page);
  await expect(root.locator('notice-display-slides [data-slide-new]')).toHaveAttribute('disabled', '');
});

test('template 2: the building photo upload, replace and removal', async ({ page }) => {
  const calls = await install(page, { template: 2 });
  const root = await openDisplay(page);
  const sl = root.locator('notice-display-slides');
  await expect(sl.locator('[data-photo-block]')).toBeVisible();
  await expect(sl.locator('[data-photo-remove]')).toHaveCount(0);
  await sl.locator('[data-photo-file]').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: PNG });
  await expect.poll(() => calls.some((c) => c.method === 'PUT' && c.path === 'notices/boards/b1/photo')).toBe(true);
  await expect(sl.locator('[data-photo-img]')).toHaveCount(1);
  await expect(sl.locator('[data-photo-remove]')).toBeVisible();
  await shot(page, 'display-photo');
  await sl.locator('[data-photo-remove]').click();
  await expect.poll(() => calls.some((c) => c.method === 'DELETE' && c.path === 'notices/boards/b1/photo')).toBe(true);
  await expect(sl.locator('[data-photo-img]')).toHaveCount(0);
});
