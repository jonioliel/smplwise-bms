import { test, expect, type Page } from '@playwright/test';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import { ROWS, digest, screen, serveTransit } from './bustimes-fixtures';
import type { TransitDigest } from '../src/notice-tv/transit-logic';
import type { Display } from '../src/notice-tv/tv-logic';

// BOARDV2-297: the V2 notice board (owner-approved mock-up private/review/NOTICE_BOARD_BUSTIMES_MOCKUP_V2_2026-10-26.html) on the product TV
// page: 40 px margins, the 96 px header with the tenant logo as uploaded and the approved SmplWise SVG, the weather always under the date, a fixed
// bus area per layout (side panel / strip row / slide), no scroll at any size, light and dark, landscape and portrait, and the five settings
// (design, layout, tenant logo size, portrait order, "next arrivals" row). Canvas pixels are measured as fractions of the zoomed #cv.
// Needs the built UI (npm run build; preview).
//   npx playwright test tests/layout-noticeboard-v2-297.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

// a 4:1 tenant logo with a transparent background (a gold bar on a clear field), served through the board token like the real one
const LOGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAYAAACm53kpAAAALklEQVR42u3QQQkAQAgAQXMZyShX+gRfZpAZ2AIbAbC8yn85AwwwwAADDDAAYDRHq87uxeRxyAAAAABJRU5ErkJggg==',
  'base64',
);

interface Open {
  layout?: 'side' | 'strip' | 'slide';
  display?: Partial<Display>;
  d?: TransitDigest | null;
  w?: number;
  h?: number;
  theme?: 'day' | 'night';
  logo?: boolean;
}

async function open(page: Page, o: Open = {}) {
  const layout = o.layout ?? 'side';
  await page.setViewportSize({ width: o.w ?? 1920, height: o.h ?? 1080 });
  const feed = lobbyFeed({ theme: o.theme ?? 'day', design: 'v2', board_layout: layout, transit: screen({ layout, rows: 4 }), ...(o.display ?? {}) });
  if (o.logo !== false) feed.board.logos = { company: 'api/v1/notices/display/lobby/logo/company' };
  await serveFeed(page, feed);
  await page.route('**/api/v1/notices/display/lobby/logo/company', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: LOGO_PNG }));
  if (o.d !== null) await serveTransit(page, o.d ?? digest({ layout, rows: 4 }));
  await page.goto(new URL(tvUrl(), base()).toString());
  await page.waitForSelector('#cv[data-design="v2"] .pg .b2hd', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(1400);
}

/** The slide is the last item of the rotation: "previous" from the first item wraps to it. */
async function showSlide(page: Page) {
  await page.evaluate(() => window.postMessage({ smplwise: 'tv', cmd: 'prev' }, location.origin));
  await page.waitForTimeout(1300);
}

interface Box { x: number; y: number; w: number; h: number }

/** Boxes in canvas pixels (the #cv design size, independent of the viewport's zoom). */
async function boxes(page: Page, sels: Record<string, string>): Promise<Record<string, Box | null>> {
  return page.evaluate((s) => {
    const cv = document.getElementById('cv') as HTMLElement;
    const c = cv.getBoundingClientRect();
    const k = c.height / parseFloat(cv.style.blockSize || '1080');
    const out: Record<string, { x: number; y: number; w: number; h: number } | null> = {};
    for (const [name, sel] of Object.entries(s)) {
      const el = document.querySelector(sel);
      if (!el) { out[name] = null; continue; }
      const r = el.getBoundingClientRect();
      out[name] = { x: (r.left - c.left) / k, y: (r.top - c.top) / k, w: r.width / k, h: r.height / k };
    }
    return out;
  }, sels);
}

async function noScroll(page: Page) {
  const r = await page.evaluate(() => {
    const over = (el: Element) => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
    const bad = [...document.querySelectorAll('.b2bus .rows, .b2bus .cards, .b2bd, .b2info, .b2hd, .b2ft')].filter(over).map((e) => e.className);
    const cv = document.getElementById('cv') as HTMLElement;
    const c = cv.getBoundingClientRect();
    const outside = [...document.querySelectorAll('.b2bus, .b2hd, .b2clock, .b2wx, .b2ft')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && (r.left < c.left - 1 || r.right > c.right + 1 || r.top < c.top - 1 || r.bottom > c.bottom + 1);
    }).map((e) => e.className);
    const root = document.documentElement;
    return { bad, outside, docOver: root.scrollHeight > innerHeight + 1 || root.scrollWidth > innerWidth + 1 };
  });
  expect(r.bad).toEqual([]);
  expect(r.outside).toEqual([]);
  expect(r.docOver).toBe(false);
}

const SIZES = [[1920, 1080], [1280, 720], [3840, 2160], [1080, 1920]] as const;

for (const layout of ['side', 'strip', 'slide'] as const) {
  for (const [w, h] of SIZES) {
    for (const theme of ['day', 'night'] as const) {
      test(`V2 ${layout}, ${theme}, ${w}x${h}: 40 px margins, weather under the date, the bus area, no scroll`, async ({ page }, info) => {
        await open(page, { layout, w, h, theme });
        const portrait = h > w;
        if (layout === 'slide' && !portrait) await showSlide(page);
        await expect(page.locator('#cv')).toHaveAttribute('data-design', 'v2');
        const pad = await page.evaluate(() => getComputedStyle(document.querySelector('#cv .pg') as HTMLElement).padding);
        expect(pad).toBe('40px');
        const b = await boxes(page, { hd: '.b2hd', date: '.b2clock .d', wx: '.b2wx', bus: '.b2bus', ft: '.b2ft' });
        expect(b.hd!.y).toBeGreaterThanOrEqual(39);
        expect(b.hd!.y).toBeLessThanOrEqual(41);
        expect(b.hd!.h).toBeGreaterThanOrEqual(portrait ? 87 : 95);
        // the weather sits under the date, in the same column, never on the bus area
        expect(b.wx!.y).toBeGreaterThanOrEqual(b.date!.y + b.date!.h - 1);
        expect(Math.min(b.wx!.x + b.wx!.w, b.date!.x + b.date!.w) - Math.max(b.wx!.x, b.date!.x)).toBeGreaterThan(0);
        const busArea = portrait || layout === 'side' ? '.b2bus.panel' : layout === 'strip' ? '.b2bus.strip' : '.b2bus.slide';
        await expect(page.locator(busArea)).toBeVisible();
        const bb = (await boxes(page, { bus: busArea }))!.bus!;
        const overlap = !(bb.x >= b.wx!.x + b.wx!.w || bb.x + bb.w <= b.wx!.x || bb.y >= b.wx!.y + b.wx!.h || bb.y + bb.h <= b.wx!.y);
        expect(overlap).toBe(false);
        if (layout === 'strip' && !portrait) expect(Math.round(bb.h)).toBe(208);
        // 40 px at the bottom: the footer ends 40 px above the canvas edge
        const cvH = await page.evaluate(() => parseFloat((document.getElementById('cv') as HTMLElement).style.blockSize));
        expect(Math.round(cvH - (b.ft!.y + b.ft!.h))).toBeGreaterThanOrEqual(39);
        await page.screenshot({ path: info.outputPath(`v2-${layout}-${theme}-${w}x${h}.png`) });
        await noScroll(page);
        expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      });
    }
  }
}

test('the bus area keeps its place in every state: the weather never moves (strip: fresh, cached, expired, no data yet)', async ({ page }) => {
  const at: Box[] = [];
  for (const d of [digest({ layout: 'strip', rows: 4 }), digest({ layout: 'strip', state: 'cached', updated_hm: '08:53', age_s: 900 }), digest({ layout: 'strip', state: 'expired', items: [], overflow: 0 })]) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, { layout: 'strip', d });
    const b = await boxes(page, { wx: '.b2wx', strip: '.b2bus.strip' });
    expect(Math.round(b.strip!.h)).toBe(208);
    at.push(b.wx!);
    await noScroll(page);
  }
  await expect(page.locator('.b2bus.strip [data-bus-state="expired"]')).toContainText('אינם זמינים');
  for (const b of at) expect([Math.round(b.x), Math.round(b.y)]).toEqual([Math.round(at[0].x), Math.round(at[0].y)]);
});

test('side panel: up to 4 rows, minutes and "now" in gold, the clock time beyond an hour, the "next" line', async ({ page }) => {
  await open(page, { d: digest({ rows: 4, specs: [{ line: '26', dest: 'קניון השרון', mins: 1, more: [15, 30] }, { line: '4', dest: 'ת. מרכזית', mins: 9, more: [24, 39] }, { line: '301', dest: 'קריית מלאכי – דרך צומת בית שמש ועוד יעדים ארוכים', mins: 75 }, ...ROWS] }) });
  const rows = page.locator('.b2bus.panel .b2r:not([hidden])');
  expect(await rows.count()).toBeLessThanOrEqual(4);
  await expect(rows.nth(0).locator('.b2eta b.now')).toContainText('עכשיו');
  await expect(rows.nth(1).locator('.b2eta')).toContainText('9');
  await expect(rows.nth(1).locator('.b2nx')).toContainText('הבאים');
  await expect(rows.nth(1).locator('.b2nx')).toContainText('24 · 39');
  await expect(rows.nth(2).locator('.b2eta b.cl')).toContainText(/\d\d:\d\d/);
  const gold = await page.evaluate(() => getComputedStyle(document.querySelector('.b2eta b.now') as HTMLElement).color);
  expect(gold).toBe('rgb(138, 106, 58)'); // #8a6a3a, the day gold
  await noScroll(page);
});

test('setting: the "next arrivals" row can be hidden', async ({ page }) => {
  await open(page, { display: { next_row: 'hide' }, d: digest({ rows: 4, specs: [{ line: '4', dest: 'ת. מרכזית', mins: 9, more: [24, 39] }] }) });
  await expect(page.locator('.b2bus .b2nx')).toHaveCount(0);
});

test('setting: the portrait order - bus panel first, or the notices first', async ({ page }) => {
  await open(page, { w: 1080, h: 1920, display: { portrait_order: 'bus' } });
  let b = await boxes(page, { bus: '.b2bus.panel', stage: '.stage.b2stage' });
  expect(b.bus!.y).toBeLessThan(b.stage!.y);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await open(page, { w: 1080, h: 1920, display: { portrait_order: 'notices' } });
  b = await boxes(page, { bus: '.b2bus.panel', stage: '.stage.b2stage' });
  expect(b.stage!.y).toBeLessThan(b.bus!.y);
  await noScroll(page);
});

test('setting: the tenant logo size (auto = 96 px, l = 120 px); the logo is drawn as uploaded by day, inverted at night when chosen', async ({ page }) => {
  await open(page, {});
  let b = await boxes(page, { co: '.b2hd .lg.company img' });
  expect(Math.round(b.co!.h)).toBe(96);
  await expect(page.locator('.b2hd .lg.company')).toHaveAttribute('data-tr', 'plain');
  await expect(page.locator('.b2hd .lg.product svg')).toHaveAttribute('data-brand-art', 'kit-horizontal-brand');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await open(page, { display: { co_size: 'l' } });
  b = await boxes(page, { co: '.b2hd .lg.company img' });
  expect(Math.round(b.co!.h)).toBe(120);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await open(page, { theme: 'night', display: { night_logo: 'invert' } });
  await expect(page.locator('.b2hd .lg.company')).toHaveAttribute('data-tr', 'invert');
  await expect(page.locator('.b2hd .lg.product svg')).toHaveAttribute('data-brand-art', 'kit-horizontal-white');
  // the tenant logo at the start (right), SmplWise at the end (left)
  b = await boxes(page, { co: '.b2hd .lg.company', sw: '.b2hd .lg.product' });
  expect(b.co!.x).toBeGreaterThan(b.sw!.x);
});

test('Heebo and the night gold', async ({ page }) => {
  await open(page, { theme: 'night' });
  const r = await page.evaluate(() => ({ font: getComputedStyle(document.querySelector('.b2clock .t') as HTMLElement).fontFamily, gold: getComputedStyle(document.querySelector('.b2wx .ic') as Element).color }));
  expect(r.font).toMatch(/^"?Heebo/);
  expect(r.gold).toBe('rgb(210, 176, 120)'); // #d2b078
});

test('the screen does not show transit: no bus area, the weather still under the date', async ({ page }) => {
  await open(page, { display: { transit: screen({ enabled: false }) }, d: null });
  await expect(page.locator('.b2bus')).toHaveCount(0);
  const b = await boxes(page, { date: '.b2clock .d', wx: '.b2wx' });
  expect(b.wx!.y).toBeGreaterThanOrEqual(b.date!.y + b.date!.h - 1);
  await noScroll(page);
});

test('the default design stays the board as before', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await serveFeed(page, lobbyFeed({ theme: 'day' }));
  await page.goto(new URL(tvUrl(), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd', { state: 'attached' });
  await expect(page.locator('#cv')).toHaveAttribute('data-design', 'classic');
  await expect(page.locator('.b2hd')).toHaveCount(0);
});
