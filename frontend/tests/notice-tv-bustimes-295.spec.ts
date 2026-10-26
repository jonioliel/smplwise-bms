import { test, expect, type Page } from '@playwright/test';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import { ROWS, columns, digest, item, screen, serveTransit, type Spec } from './bustimes-fixtures';
import type { TransitDigest } from '../src/notice-tv/transit-logic';
import type { Display } from '../src/notice-tv/tv-logic';

// BUSTIMES-295: the bus-times layouts on the product TV page - side column, bottom strip, rotating slide - in light and dark, landscape and
// portrait, at four sizes: never a scroll, the panel inside the canvas, RTL, the states (fresh / cached / expired / empty). The TV runs with
// `clock=fixed` (09:12 on 23.10.2026); the digest is the server's shape (tests/bustimes-fixtures.ts). Needs the built UI (npm run build; preview).
//   npx playwright test tests/notice-tv-bustimes-295.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

interface Open {
  d?: TransitDigest;
  layout?: 'side' | 'strip' | 'slide';
  display?: Partial<Display>;
  w?: number;
  h?: number;
  theme?: 'day' | 'night';
  q?: string;
  rows?: number;
}

async function open(page: Page, o: Open = {}) {
  const w = o.w ?? 1920;
  const h = o.h ?? 1080;
  const layout = o.layout ?? 'side';
  await page.setViewportSize({ width: w, height: h });
  await serveFeed(page, lobbyFeed({ theme: o.theme ?? 'day', transit: screen({ layout, rows: o.rows ?? 5 }), ...(o.display ?? {}) }));
  await serveTransit(page, o.d ?? digest({ layout, rows: o.rows ?? 5 }));
  await page.goto(new URL(tvUrl(o.q ?? ''), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(1300);
}

/** The slide is the last item of the rotation: "previous" from the first item wraps to it. */
async function showSlide(page: Page) {
  await page.evaluate(() => window.postMessage({ smplwise: 'tv', cmd: 'prev' }, location.origin));
  await page.waitForTimeout(1300);
}

async function noScroll(page: Page) {
  const r = await page.evaluate(() => {
    const over = (el: Element) => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;
    const bad = [...document.querySelectorAll('.bus .rows, .bus .cards, .it.transit .cols, .it.transit, .bus')].filter(over).map((e) => e.className);
    const cv = document.getElementById('cv') as HTMLElement;
    const c = cv.getBoundingClientRect();
    const outside = [...document.querySelectorAll('.bus')].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && (r.left < c.left - 1 || r.right > c.right + 1 || r.top < c.top - 1 || r.bottom > c.bottom + 1);
    }).length;
    const root = document.documentElement;
    return { bad, outside, docOver: root.scrollHeight > innerHeight + 1 || root.scrollWidth > innerWidth + 1 };
  });
  expect(r.bad).toEqual([]);
  expect(r.outside).toBe(0);
  expect(r.docOver).toBe(false);
}

const SIZES = [[1920, 1080], [1280, 720], [3840, 2160], [1080, 1920]] as const;

for (const layout of ['side', 'strip', 'slide'] as const) {
  for (const [w, h] of SIZES) {
    for (const theme of ['day', 'night'] as const) {
      test(`${layout} layout, ${theme}, ${w}x${h}: drawn, inside the canvas, no scroll, RTL`, async ({ page }, info) => {
        const d = layout === 'slide' ? digest({ layout, nstops: 3, multi: true, columns: columns(3) }) : digest({ layout });
        await open(page, { layout, w, h, theme, d });
        if (layout === 'slide') await showSlide(page);
        await expect(page.locator('#cv')).toHaveAttribute('data-bus', layout);
        await expect(page.locator('.bus').first()).toBeVisible();
        await page.screenshot({ path: info.outputPath(`bus-${layout}-${theme}-${w}x${h}.png`) });
        await noScroll(page);
        expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      });
    }
  }
}

test('side layout: at most the configured rows; the badge sits at the start (right) edge of its row', async ({ page }) => {
  await open(page, { rows: 3, d: digest({ rows: 3 }) });
  expect(await page.locator('.bus .brow').count()).toBeLessThanOrEqual(3);
  const r = await page.evaluate(() => {
    const row = document.querySelector('.bus .brow') as HTMLElement;
    const ln = row.querySelector('.ln')!.getBoundingClientRect();
    const dest = row.querySelector('.dest')!.getBoundingClientRect();
    const eta = row.querySelector('.eta')!.getBoundingClientRect();
    return { lnRight: ln.right, destRight: dest.right, etaLeft: eta.left, destLeft: dest.left };
  });
  expect(r.lnRight).toBeGreaterThanOrEqual(r.destRight - 1);
  expect(r.etaLeft).toBeLessThanOrEqual(r.destLeft + 1);
});

test('side layout with ten rows still fits: rows scale down or drop, "and N more" says how many', async ({ page }) => {
  const specs: Spec[] = [...ROWS, ...ROWS].map((r, i) => ({ ...r, mins: 3 + i * 5 }));
  await open(page, { rows: 10, d: digest({ rows: 10, specs, overflow: 4 }), w: 1280, h: 720 });
  await noScroll(page);
  expect(await page.locator('.bus .brow').count()).toBeGreaterThan(0);
});

test('fresh rows count minutes; a far one shows the clock; the first one under 2 minutes says "now"', async ({ page }) => {
  await open(page, { d: digest({ specs: [{ line: '5', dest: 'א', mins: 1 }, { line: '6', dest: 'ב', mins: 9 }, { line: '7', dest: 'ג', mins: 75 }] }) });
  const rows = page.locator('.bus .brow');
  await expect(rows.nth(0).locator('.eta')).toContainText('עכשיו');
  await expect(rows.nth(1).locator('.eta')).toContainText('9');
  await expect(rows.nth(1).locator('.eta')).toContainText("דק'");
  await expect(rows.nth(2).locator('.eta b')).toHaveClass(/cl/);
  await expect(rows.nth(2).locator('.eta')).toContainText(/\d\d:\d\d/);
});

test('cached: clock times and "not updated since", no countdown', async ({ page }) => {
  await open(page, { d: digest({ state: 'cached', updated_hm: '08:53', age_s: 900 }) });
  await expect(page.locator('.bus .bh .tt span')).toContainText('08:53');
  await expect(page.locator('.bus .brow .eta small')).toHaveCount(0);
  await expect(page.locator('.bus .brow .eta b.cl').first()).toBeVisible();
  await noScroll(page);
});

test('expired: the panel says it is unavailable and shows no row', async ({ page }) => {
  await open(page, { d: digest({ state: 'expired', items: [], overflow: 0, age_s: 4000 }) });
  await expect(page.locator('.bus [data-bus-state="expired"]')).toBeVisible();
  await expect(page.locator('.bus .brow')).toHaveCount(0);
  await noScroll(page);
});

test('expired in the slide layout: the rotation skips the slide', async ({ page }) => {
  await open(page, { layout: 'slide', d: digest({ layout: 'slide', state: 'expired', items: [], columns: [] }) });
  await expect(page.locator('#cv')).toHaveAttribute('data-bus', 'none');
  await expect(page.locator('.it.transit')).toHaveCount(0);
});

test('no buses in the window: the message and the next bus', async ({ page }) => {
  const next = { line: '28', dest: 'קניון השרון', stop: 33323, at: '2026-10-23T08:30:00Z', hm: '11:30', mins: 138 };
  await open(page, { d: digest({ items: [], overflow: 0, window_min: 30, next }) });
  await expect(page.locator('.bus [data-bus-state="empty"]')).toContainText('אין אוטובוסים');
  await expect(page.locator('.bus [data-bus-state="empty"]')).toContainText('11:30');
  await noScroll(page);
});

test('the board does not show transit: no panel and no digest request', async ({ page }) => {
  let asked = 0;
  await page.route('**/api/v1/notices/display/lobby/transit', async (r) => { asked++; await r.fulfill({ status: 200, body: '{}' }); });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await serveFeed(page, lobbyFeed({}));
  await page.goto(new URL(tvUrl(), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd', { state: 'attached' });
  await page.waitForTimeout(800);
  await expect(page.locator('.bus')).toHaveCount(0);
  await expect(page.locator('#cv')).toHaveAttribute('data-bus', 'none');
  expect(asked).toBe(0);
});

test('the digest request carries the board token and no cookie', async ({ page }) => {
  const seen: string[] = [];
  await page.route('**/api/v1/notices/display/lobby/transit', async (r) => {
    seen.push(r.request().headers()['x-board-token'] ?? '');
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(digest()) });
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await serveFeed(page, lobbyFeed({ transit: screen() }));
  await page.goto(new URL(tvUrl(), base()).toString());
  await page.waitForSelector('.bus');
  expect(seen.length).toBeGreaterThan(0);
  expect(seen[0]).toMatch(/^[A-Za-z0-9_-]{20,}$/);
});

test('English board: English wording, left-to-right text inside the right-to-left page', async ({ page }) => {
  await open(page, { display: { lang: 'en' }, d: digest({ items: [], overflow: 0, window_min: 60, next: null }) });
  await expect(page.locator('.bus [data-bus-state="empty"]')).toContainText('No buses in the next hour');
});

test('side layout on template 2', async ({ page }) => {
  await open(page, { display: { template: 2 } });
  await expect(page.locator('#cv')).toHaveAttribute('data-bus', 'side');
  await noScroll(page);
});

test('template 3 has no side column: the side layout takes the strip', async ({ page }) => {
  await open(page, { display: { template: 3 } });
  await expect(page.locator('#cv')).toHaveAttribute('data-bus', 'strip');
  await noScroll(page);
});

test('the slide layout in "all together" mode falls back to the strip (there is no rotation to join)', async ({ page }) => {
  await open(page, { layout: 'slide', display: { mode: 'all' }, d: digest({ layout: 'slide', columns: columns(2), nstops: 2 }) });
  await expect(page.locator('#cv')).toHaveAttribute('data-bus', 'strip');
});

// ---- the estimate line with the distance (owner 26.10): "800 m away - est. in 3 min" under the destination / on the card
const EST: Spec[] = ROWS.map((r, i) => (i < 4 ? { ...r, dist: [400, 800, 1200, 2500][i], posAge: 90 } : r));

for (const layout of ['side', 'strip', 'slide'] as const) {
  for (const [w, h] of [[1920, 1080], [1080, 1920]] as const) {
    for (const theme of ['day', 'night'] as const) {
      test(`${layout} with distance rows, ${theme}, ${w}x${h}: the line is drawn, no scroll, nothing outside the canvas`, async ({ page }, info) => {
        const nst = layout === 'slide' ? 2 : 1;
        const nrows = layout === 'side' ? 3 : 5; // the side column is short at 1080p: three rows leave room for the distance lines (with five they are dropped first, by design)
        const d = layout === 'slide'
          ? digest({ layout, nstops: nst, multi: true, columns: columns(nst).map((c, k) => ({ ...c, items: ROWS.filter((_r, i) => i % nst === k).map((r, i) => item({ ...r, stop: c.stop, ...(i < 2 ? { dist: 800 + 400 * i, posAge: 90 } : {}) })) })) })
          : digest({ layout, rows: nrows, specs: EST });
        await open(page, { layout, w, h, theme, d, rows: nrows });
        if (layout === 'slide') await showSlide(page);
        await expect(page.locator('.bus').first()).toBeVisible();
        expect(await page.locator('.bus .est').count()).toBeGreaterThan(0);
        // distance first, then the estimate, in reading order (RTL flows right to left by itself)
        const text = ((await page.locator('.bus .est').first().textContent()) ?? '').replace(/\s+/g, ' ');
        expect(text).toMatch(/מ׳ מהתחנה.*הערכה/);
        expect(await page.locator('.bus .brow .est, .bus .bcard .est').first().evaluate((e) => getComputedStyle(e).direction)).toBe('rtl');
        await page.screenshot({ path: info.outputPath(`bus-est-${layout}-${theme}-${w}x${h}.png`) });
        await noScroll(page);
        if (layout !== 'strip') await expect(page.locator('.bus .est:visible').first()).toBeVisible(); // side / slide have the room for at least the first line
        await page.screenshot({ path: info.outputPath(`bus-est-${layout}-${theme}-${w}x${h}.png`) });
      });
    }
  }
}

test('the distance lines go before rows are dropped when the panel is tight (side, 1280x720)', async ({ page }) => {
  await open(page, { layout: 'side', w: 1280, h: 720, d: digest({ layout: 'side', rows: 8, specs: ROWS.map((r) => ({ ...r, dist: 600, posAge: 60 })) }), rows: 8 });
  await noScroll(page);
  const r = await page.evaluate(() => ({
    est: document.querySelectorAll('.bus .est').length, estHidden: document.querySelectorAll('.bus .est[hidden]').length,
    rowsHidden: document.querySelectorAll('.bus .brow[hidden]').length,
  }));
  expect(r.est).toBeGreaterThan(0);
  if (r.rowsHidden > 0) expect(r.estHidden).toBe(r.est); // a row was dropped only after every distance line had been
});

test('a digest without distances draws the plain rows (installation switch off) with the estimate marker only', async ({ page }) => {
  await open(page, { layout: 'side', d: digest({ layout: 'side', show_distance: false, specs: EST.map(({ dist: _d, ...r }) => r) }) });
  expect(await page.locator('.bus .est').count()).toBe(0);
  await noScroll(page);
});

test('the screen fetches the digest again at the cadence the server gave and keeps counting between fetches', async ({ page }) => {
  let hits = 0;
  await page.route('**/api/v1/notices/display/lobby/transit', async (route) => {
    hits++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(digest({ layout: 'side', refresh_s: 10 })) });
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await serveFeed(page, lobbyFeed({ theme: 'day', transit: screen({ layout: 'side' }) }));
  await page.goto(new URL(tvUrl().replace('&clock=fixed', ''), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd', { state: 'attached' });
  await page.waitForTimeout(1500);
  expect(hits).toBe(1);
  await page.waitForTimeout(11_500);
  expect(hits).toBeGreaterThanOrEqual(2);
  expect(hits).toBeLessThanOrEqual(3);
});
