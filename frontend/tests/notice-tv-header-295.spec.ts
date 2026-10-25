import { test, expect, type Page } from '@playwright/test';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import type { Display, Feed } from '../src/notice-tv/tv-logic';

// TVOPT-295: the TV screen choices of the one-row header review - the header (a / b / c), the "updated" line, what the freed height
// goes to, and the company logo on the dark screen - in the product TV page, landscape and portrait. Structure and geometry only
// (no pixel baselines here).
//   npx playwright test tests/notice-tv-header-295.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

// an opaque logo (a filled box) and one with a transparent background (a mark on nothing)
const OPAQUE = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><rect width="300" height="100" fill="#1e2e47"/></svg>';
const CLEAR = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><circle cx="150" cy="50" r="30" fill="#1e2e47"/></svg>';

let opened = 0;

interface Opts { w?: number; h?: number; q?: string; logo?: 'opaque' | 'clear' | 'none'; dark?: boolean; darkMode?: 'plate' | 'file' | 'invert'; feed?: (f: Feed) => void }

async function open(page: Page, display: Partial<Display>, o: Opts = {}) {
  const { w = 1920, h = 1080, q = '', logo = 'opaque', dark = false, darkMode = 'plate' } = o;
  await page.setViewportSize({ width: w, height: h });
  const feed = lobbyFeed(display);
  if (logo !== 'none') {
    feed.board.logos = { company: 'api/v1/notices/display/lobby/logo/company?variant=light&v=aaaaaaaaaaaaaaaa' };
    if (dark) feed.board.logos.company_dark = 'api/v1/notices/display/lobby/logo/company?variant=dark&v=bbbbbbbbbbbbbbbb';
    feed.board.brand = { size: 'm', dark_mode: darkMode, name: 'מגדל הים' };
  }
  o.feed?.(feed);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  if (logo !== 'none') {
    await page.route('**/api/v1/notices/display/lobby/logo/company**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/svg+xml', body: route.request().url().includes('variant=dark') ? CLEAR.replace('#1e2e47', '#f0d6a0') : logo === 'clear' ? CLEAR : OPAQUE }));
  }
  await serveFeed(page, feed);
  // a fresh document every time (the same URL with the same fragment would be a same-document navigation)
  await page.goto(new URL(tvUrl([q, 'n=' + ++opened].filter(Boolean).join('&')), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(1200);
}

/** Every visible box of the header stays inside the canvas, and no text of the header row is cut by its own box. */
async function headerFits(page: Page) {
  return page.evaluate(() => {
    const cv = (document.getElementById('cv') as HTMLElement).getBoundingClientRect();
    const hd = document.querySelector('#cv .pg .hd') as HTMLElement;
    const out: string[] = [];
    for (const el of [hd, ...Array.from(hd.querySelectorAll<HTMLElement>('*'))]) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < cv.left - 1 || r.right > cv.right + 1 || r.top < cv.top - 1 || r.bottom > cv.bottom + 1) out.push('outside:' + el.className);
    }
    if (hd.scrollWidth > hd.clientWidth + 1) out.push('header scrolls');
    return out;
  });
}

for (const [w, h, name] of [[1920, 1080, 'landscape'], [1080, 1920, 'portrait']] as const) {
  test(`header c (the default) is the screen as before - ${name}`, async ({ page }) => {
    await open(page, {}, { w, h });
    await expect(page.locator('#cv')).toHaveAttribute('data-header', 'c');
    await expect(page.locator('#cv .pg .hd.one')).toHaveCount(0);
    await expect(page.locator('#cv .pg .side .welcome')).toHaveCount(1);
    await expect(page.locator('#cv .pg .ft .live')).toContainText('עודכן');
    await expect(page.locator('#cv .pg .ft .lg.product')).toHaveCount(1);
  });

  for (const hdr of ['a', 'b'] as const) {
    test(`header ${hdr}: one row with both logos, the greeting and the status; no separate bottom row - ${name}`, async ({ page }) => {
      await open(page, { header: hdr }, { w, h, feed: (f) => { delete f.info; } }); // no building chips
      const hd = page.locator(`#cv .pg .hd.one[data-h="${hdr}"]`);
      await expect(hd).toHaveCount(1);
      await expect(hd.locator('.lg.company img')).toHaveCount(1);
      await expect(hd.locator('.lg.product svg')).toHaveCount(1);
      await expect(hd.locator('.hw small')).toHaveText('ברוכים הבאים');
      await expect(hd.locator('.hw b')).toHaveText('מגדל הים');
      await expect(hd.locator('.live')).toContainText('עודכן');
      await expect(page.locator('#cv .pg .side .welcome')).toHaveCount(0); // the greeting moved up
      await expect(page.locator('#cv .pg .ft')).toHaveCount(0); // nothing left for a bottom row
      expect(await headerFits(page)).toEqual([]);
      if (hdr === 'b' && name === 'landscape') {
        const c = await page.evaluate(() => {
          const r = (document.querySelector('#cv .hd.one .hw') as HTMLElement).getBoundingClientRect();
          const cv = (document.getElementById('cv') as HTMLElement).getBoundingClientRect();
          return { hw: r.left + r.width / 2, cv: cv.left + cv.width / 2 };
        });
        expect(Math.abs(c.hw - c.cv)).toBeLessThan(6); // the greeting is centred on the screen
      }
      // the logos sit at the two ends of the row (RTL: the company logo at the right, SmplWise at the left)
      const ends = await page.evaluate(() => {
        const hd = (document.querySelector('#cv .pg .hd') as HTMLElement).getBoundingClientRect();
        const co = (document.querySelector('#cv .pg .hd .lg.company') as HTMLElement).getBoundingClientRect();
        const sw = (document.querySelector('#cv .pg .hd .lg.product') as HTMLElement).getBoundingClientRect();
        return { co: hd.right - co.right, sw: sw.left - hd.left };
      });
      expect(ends.co).toBeLessThan(2);
      expect(ends.sw).toBeLessThan(2);
    });
  }
}

test('header a keeps the bottom row only for the building chips of template 1', async ({ page }) => {
  await open(page, { header: 'a' });
  await expect(page.locator('#cv .pg .ft .chips .ch')).toHaveCount(4);
  await expect(page.locator('#cv .pg .ft .live, #cv .pg .ft .lg, #cv .pg .ft .offline')).toHaveCount(0);
  await expect(page.locator('#cv .pg .hd .live')).toHaveCount(1);
});

test('header a with no company logo drops the logo and its hairline, the greeting opens the row', async ({ page }) => {
  await open(page, { header: 'a' }, { logo: 'none' });
  await expect(page.locator('#cv .pg .hd .lg.company')).toBeHidden();
  await expect(page.locator('#cv .pg .hd .hdv')).toBeHidden();
  const gap = await page.evaluate(() => {
    const hd = (document.querySelector('#cv .pg .hd') as HTMLElement).getBoundingClientRect();
    const hw = (document.querySelector('#cv .pg .hd .hw') as HTMLElement).getBoundingClientRect();
    return hd.right - hw.right;
  });
  expect(gap).toBeLessThan(2);
});

test('the logo layout setting applies to the header as before only', async ({ page }) => {
  await open(page, { header: 'a', logos: 'b' });
  await expect(page.locator('#cv .pg .hd')).toBeVisible();
  await expect(page.locator('#cv .pg .ft .lgs')).toHaveCount(0);
});

test('the ?header= test hook overrides the stored choice', async ({ page }) => {
  await open(page, { header: 'c' }, { q: 'header=b' });
  await expect(page.locator('#cv .pg .hd.one[data-h="b"]')).toHaveCount(1);
});

for (const hdr of ['a', 'c'] as const) {
  test(`the "updated" line: full / time / issues (header ${hdr})`, async ({ page }) => {
    const live = hdr === 'c' ? '#cv .pg .ft .live' : '#cv .pg .hd .live';
    await open(page, { header: hdr, updated: 'full' });
    await expect(page.locator(live)).toContainText('עודכן');
    await expect(page.locator(live)).toContainText('לוח הלובי');
    await open(page, { header: hdr, updated: 'time' });
    await expect(page.locator(live)).toHaveText('09:12');
    await expect(page.locator(live + ' i')).toBeVisible(); // the green dot
    await open(page, { header: hdr, updated: 'issues' });
    await expect(page.locator('#cv .pg .live')).toHaveCount(0);
    await expect(page.locator('#cv')).toHaveAttribute('data-updated', 'issues');
  });
}

test('the freed height: bigger / mix scale the body, more keeps the sizes; the header as before keeps them always', async ({ page }) => {
  const fs = () => page.evaluate(() => getComputedStyle(document.querySelector('#cv .pg .bd') as HTMLElement).getPropertyValue('--fs').trim());
  await open(page, { header: 'a', space: 'bigger' });
  expect(Number(await fs())).toBeCloseTo(0.78 * 1.16, 2);
  await open(page, { header: 'a', space: 'mix' });
  expect(Number(await fs())).toBeCloseTo(0.78 * 1.08, 2);
  await open(page, { header: 'a', space: 'more' });
  expect(Number(await fs())).toBeCloseTo(0.78, 2);
  await open(page, { header: 'c', space: 'bigger' });
  expect(Number(await fs())).toBeCloseTo(0.78, 2);
  await expect(page.locator('#cv')).toHaveAttribute('data-space', 'none');
});

test('the freed height: more / mix list one more card in the focus mode and one more row in "all together"', async ({ page }) => {
  await open(page, { header: 'a', space: 'bigger', mode: 'focus' });
  await expect(page.locator('#cv .stage.focus .others .cell')).toHaveCount(3);
  await open(page, { header: 'a', space: 'more', mode: 'focus' });
  await expect(page.locator('#cv .stage.focus .others .cell')).toHaveCount(4);
  await open(page, { header: 'c', space: 'more', mode: 'focus' });
  await expect(page.locator('#cv .stage.focus .others .cell')).toHaveCount(3);
  await open(page, { header: 'a', space: 'bigger', mode: 'all', template: 3 });
  await expect(page.locator('#cv .stage.all .cell')).toHaveCount(6);
  await open(page, { header: 'a', space: 'mix', mode: 'all', template: 3 });
  await expect(page.locator('#cv .stage.all .cell')).toHaveCount(7); // all seven fit one page (up to nine with the extra row)
});

test('the body never overflows the canvas with the larger sizes (landscape and portrait, every template)', async ({ page }) => {
  for (const [w, h] of [[1920, 1080], [1080, 1920]] as const) {
    for (const template of [1, 2, 3] as const) {
      await open(page, { header: 'a', space: 'bigger', template }, { w, h });
      const bad = await page.evaluate(() => {
        const cv = (document.getElementById('cv') as HTMLElement).getBoundingClientRect();
        const bd = (document.querySelector('#cv .pg .bd') as HTMLElement).getBoundingClientRect();
        return bd.bottom > cv.bottom + 1 || bd.right > cv.right + 1 || bd.left < cv.left - 1;
      });
      expect(bad, `${w}x${h} template ${template}`).toBe(false);
    }
  }
});

test('the company logo at night: plate, invert when possible, auto', async ({ page }) => {
  const tr = () => page.locator('#cv .pg .hd .lg.company').getAttribute('data-tr');
  // plate: always the white plate, even when the system setting says invert
  await open(page, { night_logo: 'plate' }, { q: 'theme=night', logo: 'clear', darkMode: 'invert' });
  expect(await tr()).toBe('plate');
  // invert + a transparent light file: the inverted logo
  await open(page, { night_logo: 'invert' }, { q: 'theme=night', logo: 'clear' });
  expect(await tr()).toBe('invert');
  // invert + an opaque light file: an inverted box would be a dark box - the plate stays
  await open(page, { night_logo: 'invert' }, { q: 'theme=night', logo: 'opaque' });
  expect(await tr()).toBe('plate');
  // invert + a dark file: the dark file as uploaded
  await open(page, { night_logo: 'invert' }, { q: 'theme=night', logo: 'opaque', dark: true });
  expect(await tr()).toBe('plain');
  await expect(page.locator('#cv .pg .hd .lg.company img')).toHaveAttribute('src', /^blob:/);
  // auto: the system logo setting decides (here: invert)
  await open(page, { night_logo: 'auto' }, { q: 'theme=night', logo: 'opaque', darkMode: 'invert' });
  expect(await tr()).toBe('invert');
  // by day the logo is drawn as uploaded whatever the choice
  await open(page, { night_logo: 'invert' }, { q: 'theme=day', logo: 'clear' });
  expect(await tr()).toBe('plain');
});

test('the TV screen carries no hint text for the new choices', async ({ page }) => {
  await open(page, { header: 'b', updated: 'time', space: 'mix', night_logo: 'invert' });
  const text = await page.locator('#cv .pg').innerText();
  for (const word of ['כותרת', 'הגובה', 'לפי הגדרות', 'כשאפשר']) expect(text).not.toContain(word);
});

// TVOPT-295 weather_days (owner 2026-10-25): today only, or today and up to five days; a source with fewer days shows what it has
const DAYS = [
  { date: '2026-10-23', t: 26, lo: 17, condition: 'sun' }, { date: '2026-10-24', t: 27, lo: 18, condition: 'cloudsun' }, { date: '2026-10-25', t: 24, condition: 'cloud' },
  { date: '2026-10-26', t: 23, lo: 15, condition: 'cloud' }, { date: '2026-10-27', t: 25, lo: 16, condition: 'sun' },
];
for (const [w, h, name] of [[1920, 1080, 'landscape'], [1080, 1920, 'portrait']] as const) {
  test(`weather days: as before / today only / N days / fewer days in the source - ${name}`, async ({ page }) => {
    const withDays = (n: number) => (f: Feed) => { if (f.weather) f.weather.days = DAYS.slice(0, n); };
    await open(page, { weather_days: 0 }, { w, h, feed: withDays(5) });
    await expect(page.locator('#cv .wx .hrs:not(.days) > div')).toHaveCount(5); // the hourly row as before
    await expect(page.locator('#cv .wx .hrs.days')).toHaveCount(0);
    await open(page, { weather_days: 1 }, { w, h, feed: withDays(5) });
    await expect(page.locator('#cv .wx .hrs')).toHaveCount(0);
    await expect(page.locator('#cv .wx .now')).toBeVisible();
    await open(page, { weather_days: 4 }, { w, h, feed: withDays(5) });
    const cells = page.locator('#cv .wx .hrs.days > div');
    await expect(cells).toHaveCount(4);
    await expect(cells.first().locator('span')).toHaveText('היום');
    await expect(cells.nth(1).locator('span')).toHaveText(/שבת|ש׳/); // 24.10.2026 is a Saturday
    await expect(cells.nth(2).locator('i.lo')).toHaveCount(0); // no low in the source: none drawn
    await expect(cells.first().locator('i.lo')).toHaveText('17°');
    await open(page, { weather_days: 5 }, { w, h, feed: withDays(2) });
    await expect(page.locator('#cv .wx .hrs.days > div')).toHaveCount(2);
    await open(page, { weather_days: 5 }, { w, h, feed: withDays(1) });
    await expect(page.locator('#cv .wx .hrs')).toHaveCount(0); // only today in the source: no row
  });
}

test('weather days on template 3 (landscape) sit next to the current conditions and stay inside the canvas', async ({ page }) => {
  await open(page, { template: 3, weather_days: 5 }, { feed: (f) => { if (f.weather) f.weather.days = DAYS; } });
  await expect(page.locator('#cv .bot .wx .hrs.days > div')).toHaveCount(5);
  await expect(page.locator('#cv .bot .wx .hrs.days')).toBeVisible();
  const out = await page.evaluate(() => {
    const cv = (document.getElementById('cv') as HTMLElement).getBoundingClientRect();
    const r = (document.querySelector('#cv .bot .wx') as HTMLElement).getBoundingClientRect();
    return r.left < cv.left - 1 || r.right > cv.right + 1 || r.bottom > cv.bottom + 1;
  });
  expect(out).toBe(false);
});