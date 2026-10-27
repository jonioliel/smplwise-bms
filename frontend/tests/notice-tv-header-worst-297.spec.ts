import { test, expect, type Page } from '@playwright/test';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import type { Display, Feed } from '../src/notice-tv/tv-logic';

// TVNOTICE-297 (board rows r393 / r323): the TV notice board's one-row header under worst-case data. One row carries the installation
// owner's logo, "ברוכים הבאים" with the place name, and the SmplWise logo with the status; every logo shows, the row reads RTL, nothing
// scrolls at 1920x1080 / 1280x720 (and portrait), and long names never break the layout. Geometry only (no pixel baselines).
//   npx playwright test tests/notice-tv-header-worst-297.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

// logos of awkward shapes: a very wide banner, a tall crest, an ordinary box
const svg = (w: number, h: number, fill = '#1e2e47') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`;
const LOGOS = { wide: svg(1600, 100), tall: svg(120, 480), box: svg(300, 100) } as const;
type LogoShape = keyof typeof LOGOS;

// worst-case names: a long multi-word name, one unbreakable Hebrew word, a long Latin name with no spaces
const LONG_NAME = 'מרכז הקהילה והספורט העירוני על שם משפחת בן־עמי ברחוב הנביאים 128 בירושלים';
const UNBREAKABLE = 'מגדלהיםהתיכוןבנייןמגוריםוחניוןתתקרקעיצפוני'.repeat(2);
const LATIN = 'TheExtraordinarilyLongResidentialTowerManagementCompanyLtd';
const LONG_BOARD = 'לוח הלובי של הכניסה הצפונית בקומת הקרקע ליד המעליות';

interface Opts { w: number; h: number; logo?: LogoShape | 'none'; building?: string; boardName?: string; size?: 's' | 'm' | 'l' | 'xl'; lang?: 'he' | 'en'; q?: string }

let opened = 0;

async function open(page: Page, display: Partial<Display>, o: Opts) {
  await page.setViewportSize({ width: o.w, height: o.h });
  const feed: Feed = lobbyFeed({ ...display, ...(o.lang ? { lang: o.lang } : {}) });
  delete feed.info; // no building chips: the one-row header leaves no bottom row
  if (o.building !== undefined) feed.board.building = o.building;
  if (o.boardName !== undefined) feed.board.name = o.boardName;
  const logo = o.logo ?? 'box';
  if (logo !== 'none') {
    feed.board.logos = { company: 'api/v1/notices/display/lobby/logo/company?variant=light&v=aaaaaaaaaaaaaaaa' };
    feed.board.brand = { size: o.size ?? 'm', company_size: o.size, dark_mode: 'plate', name: feed.board.building };
  }
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  if (logo !== 'none') {
    await page.route('**/api/v1/notices/display/lobby/logo/company**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGOS[logo] }));
  }
  await serveFeed(page, feed);
  await page.goto(new URL(tvUrl([o.q ?? '', 'n=' + ++opened].filter(Boolean).join('&')), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd.one', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(900);
}

interface Box { l: number; r: number; t: number; b: number; w: number; h: number }

/** The geometry of the header row and its three groups, in canvas pixels (the canvas is zoomed to the viewport). */
async function measure(page: Page) {
  return page.evaluate(() => {
    const cv = document.getElementById('cv') as HTMLElement;
    const z = Number(getComputedStyle(cv).zoom) || 1;
    const c = cv.getBoundingClientRect();
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height };
    };
    const hd = document.querySelector('#cv .pg .hd.one') as HTMLElement;
    const out: string[] = [];
    for (const el of [hd, ...Array.from(hd.querySelectorAll<HTMLElement>('*'))]) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.left < c.left - 1 || r.right > c.right + 1 || r.top < c.top - 1 || r.bottom > c.bottom + 1) out.push('outside canvas: ' + el.tagName + '.' + el.className);
      if (r.left < hd.getBoundingClientRect().left - 1 || r.right > hd.getBoundingClientRect().right + 1) out.push('outside header: ' + el.tagName + '.' + el.className);
    }
    if (hd.scrollWidth > hd.clientWidth + 1) out.push('header scrolls sideways');
    const de = document.documentElement;
    if (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) out.push('page scrolls');
    const name = hd.querySelector('.hw b') as HTMLElement | null;
    return {
      z,
      bad: out,
      hd: box(hd) as Box,
      co: box(hd.querySelector('.lg.company img')),
      sw: box(hd.querySelector('.lg.product svg')),
      small: box(hd.querySelector('.hw small')),
      name: box(name),
      nameText: name?.textContent ?? '',
      status: box(hd.querySelector('.hst')),
      dir: getComputedStyle(hd).direction,
      bd: box(document.querySelector('#cv .pg .bd')),
    };
  });
}

const overlap = (a: Box | null, b: Box | null) => !!a && !!b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;

const SIZES = [[1920, 1080, '1080p'], [1280, 720, '720p'], [1080, 1920, 'portrait 1080'], [720, 1280, 'portrait 720']] as const;
const CASES: { label: string; o: Partial<Opts> }[] = [
  { label: 'long name, wide logo', o: { building: LONG_NAME, logo: 'wide', boardName: LONG_BOARD } },
  { label: 'unbreakable name, tall logo, xl logos', o: { building: UNBREAKABLE, logo: 'tall', size: 'xl' } },
  { label: 'Latin name in English', o: { building: LATIN, lang: 'en', logo: 'wide', boardName: LONG_BOARD } },
];

for (const hdr of ['a', 'b'] as const) {
  for (const [w, h, sz] of SIZES) {
    for (const k of CASES) {
      test(`header ${hdr} - ${sz} - ${k.label}: one row, all logos, no scroll`, async ({ page }) => {
        await open(page, { header: hdr, updated: 'full' }, { w, h, ...k.o });
        const m = await measure(page);
        expect(m.bad).toEqual([]);
        expect(m.dir).toBe('rtl');
        // every piece is drawn: both logos and the greeting with (part of) the place name
        expect(m.co, 'company logo').not.toBeNull();
        expect(m.sw, 'SmplWise logo').not.toBeNull();
        expect(m.small, 'the welcome words').not.toBeNull();
        expect(m.name, 'the place name').not.toBeNull();
        expect((m.co as Box).w / m.z).toBeGreaterThan(20); // a tall crest is narrow at the row's height, but it is drawn
        expect((m.name as Box).w / m.z).toBeGreaterThan(120); // the name keeps a readable share of the row
        // one row: the logos and the greeting sit inside the header's band, not stacked under each other
        const hd = m.hd;
        for (const [n, b] of [['company', m.co], ['greeting', m.name]] as const) {
          expect((b as Box).t, n).toBeGreaterThanOrEqual(hd.t - 1);
          expect((b as Box).b, n).toBeLessThanOrEqual(hd.b + 1);
        }
        expect(hd.h / m.z).toBeLessThan(h > w ? 260 : 170); // a header, not a block
        // nothing overlaps
        expect(overlap(m.co, m.name)).toBe(false);
        expect(overlap(m.sw, m.name)).toBe(false);
        expect(overlap(m.co, m.sw)).toBe(false);
        expect(overlap(m.status, m.name)).toBe(false);
        // RTL: the company logo at the right end, SmplWise towards the left
        expect(hd.r - (m.co as Box).r).toBeLessThan(2);
        expect((m.sw as Box).l - hd.l).toBeLessThan(hd.w / 3);
        // the body starts under the header
        expect((m.bd as Box).t).toBeGreaterThanOrEqual(hd.b - 1);
        // a name too long for the row is cut visually only: the element keeps the whole name (an assistive reader reads it in full)
        expect(m.nameText).toBe(k.o.building);
      });
    }
  }
}

test('the header row carries the place name as the board feed sends it, and the welcome words in the board language', async ({ page }) => {
  await open(page, { header: 'a' }, { w: 1920, h: 1080, building: 'מתנס אפרת' });
  await expect(page.locator('#cv .hd.one .hw small')).toHaveText('ברוכים הבאים');
  await expect(page.locator('#cv .hd.one .hw b')).toHaveText('מתנס אפרת');
  await open(page, { header: 'a' }, { w: 1920, h: 1080, building: 'Ocean Tower', lang: 'en' });
  await expect(page.locator('#cv .hd.one .hw small')).toHaveText('Welcome');
  await expect(page.locator('#cv .hd.one .hw b')).toHaveText('Ocean Tower');
});

test('no place name: the greeting stands alone, no empty box', async ({ page }) => {
  await open(page, { header: 'a' }, { w: 1920, h: 1080, building: '' });
  await expect(page.locator('#cv .hd.one .hw small')).toHaveText('ברוכים הבאים');
  await expect(page.locator('#cv .hd.one .hw b')).toHaveCount(0);
});

test('the urgent take-over keeps both logos and stays inside the canvas with long names (1080p, 720p, portrait)', async ({ page }) => {
  for (const [w, h] of [[1920, 1080], [1280, 720], [1080, 1920]] as const) {
    await page.setViewportSize({ width: w, height: h });
    const feed = lobbyFeed({ header: 'a', urgent: 'full' });
    feed.notices[0] = { ...feed.notices[0], published_at: '2026-10-23T06:11:40Z' };
    feed.board.building = LONG_NAME;
    feed.board.name = LONG_BOARD;
    feed.board.logos = { company: 'api/v1/notices/display/lobby/logo/company?variant=light&v=aaaaaaaaaaaaaaaa' };
    feed.board.brand = { size: 'l', dark_mode: 'plate', name: LONG_NAME };
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route('**/api/v1/notices/display/lobby/logo/company**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGOS.wide }));
    await serveFeed(page, feed);
    await page.goto(new URL(tvUrl('now=2026-10-23T06:12:00Z&n=' + ++opened), base()).toString());
    await page.waitForSelector('#cv[data-urgent="full"] .take .top .lg.company img');
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const c = (document.getElementById('cv') as HTMLElement).getBoundingClientRect();
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('#cv .take .top *, #cv .take .bot *'))) {
        const b = el.getBoundingClientRect();
        if (b.width && b.height && (b.left < c.left - 1 || b.right > c.right + 1 || b.bottom > c.bottom + 1)) out.push(el.tagName + '.' + el.className);
      }
      const de = document.documentElement;
      if (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) out.push('page scrolls');
      const sw = document.querySelector('#cv .take .bot .lg.product svg')?.getBoundingClientRect();
      return { out, sw: !!sw && sw.width > 10 };
    });
    expect(r.out, `${w}x${h}`).toEqual([]);
    expect(r.sw).toBe(true);
  }
});

test('no company logo uploaded: the SmplWise logo and the greeting still share the one row, nothing scrolls', async ({ page }) => {
  for (const [w, h] of [[1920, 1080], [1280, 720]] as const) {
    await open(page, { header: 'a' }, { w, h, logo: 'none', building: LONG_NAME });
    const m = await measure(page);
    expect(m.bad).toEqual([]);
    expect(m.co).toBeNull();
    expect(m.sw).not.toBeNull();
    expect(m.name).not.toBeNull();
  }
});
