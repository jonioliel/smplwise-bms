import { test, expect, type Page } from '@playwright/test';
import { LOBBY_NOTICES, lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import type { Display, Feed, FeedNotice } from '../src/notice-tv/tv-logic';

// TEMP visual review (not kept): the luxury lobby notice-board styles (Gallery, Concierge, Stone) on the product TV page, from the owner-approved mock-up
// (private/design-system-2026-10-27/round7/noticeboard-luxury) and the owner decisions of 2026-10-30: four canvases, light / dark, no scroll,
// no text under 20 px, the urgent screen only in the first minute (one deep colour per style) and then a regular message marked urgent,
// reduced motion = fades, the long body shrinks, both logos (SmplWise and the developer's), the day / night building photo, the systems row
// only on problems, one news headline at a time.  Needs the built UI (npm run build; preview).
//   npx playwright test tests/layout-noticeboard-luxury-2300.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));
test.describe.configure({ timeout: 90_000 });

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const SKINS = ['gallery', 'concierge', 'stone'] as const;
type Skin = (typeof SKINS)[number];
const URGENT_RGB: Record<Skin, string> = { gallery: 'rgb(94, 31, 29)', concierge: 'rgb(107, 26, 23)', stone: 'rgb(138, 44, 27)' };
const CO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 48"><rect width="120" height="48" rx="6" fill="#1d56c9"/><text x="60" y="31" font-size="20" text-anchor="middle" fill="#fff" font-family="Arial">DEV</text></svg>';
const PHOTO = (tag: string, c1: string, c2: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><!-- ${tag} --><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><rect x="520" y="140" width="560" height="860" fill="rgba(255,255,255,.18)"/></svg>`;

let opened = 0;
interface Open {
  skin: Skin;
  display?: Partial<Display>;
  notices?: FeedNotice[];
  extra?: Partial<Feed>;
  w?: number;
  h?: number;
  theme?: 'day' | 'night';
  q?: string;
  /** a developer logo is configured */
  logo?: boolean;
  /** the building photos: day, night, both or none */
  photos?: 'both' | 'day' | 'none';
  /** a running clock (the news changes, the drift runs) instead of the fixed one */
  live?: boolean;
}

async function open(page: Page, o: Open): Promise<Feed> {
  await page.setViewportSize({ width: o.w ?? 1920, height: o.h ?? 1080 });
  const photos = o.photos ?? 'both';
  const disp: Partial<Display> = { theme: o.theme ?? 'day', design: o.skin, ...(o.display ?? {}) };
  if (photos !== 'none') (disp as Record<string, unknown>).photo = 'assets/photo-day.svg';
  if (photos === 'both') (disp as Record<string, unknown>).photo_night = 'assets/photo-night.svg';
  const feed = lobbyFeed(disp, o.notices ?? LOBBY_NOTICES, o.extra ?? {});
  if (o.logo) {
    feed.board.logos = { company: 'assets/co-test.svg' };
    await page.route('**/assets/co-test.svg', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: CO_SVG }));
  }
  await page.route('**/assets/photo-day.svg', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: PHOTO('DAYIMG', '#d9cdb8', '#8c7a5b') }));
  await page.route('**/assets/photo-night.svg', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: PHOTO('NIGHTIMG', '#0c1426', '#3a3350') }));
  await serveFeed(page, feed);
  const url = tvUrl([o.q ?? '', 'n=' + ++opened].filter(Boolean).join('&'));
  await page.goto(new URL(o.live ? url.replace('&clock=fixed', '') : url, base()).toString());
  await page.waitForSelector('#nbk[data-ready="1"]', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(o.logo || photos !== 'none' ? 900 : 500);
  return feed;
}

const cmd = (page: Page, c: string) => page.evaluate((x) => window.postMessage({ smplwise: 'tv', cmd: x }, location.origin), c);
const NORMAL = [LOBBY_NOTICES.find((n) => n.severity !== 'critical') as FeedNotice, ...LOBBY_NOTICES.filter((n) => n.severity !== 'critical').slice(1, 4)];
const CRIT = LOBBY_NOTICES.find((n) => n.severity === 'critical') as FeedNotice;
const shownTitle = (page: Page) => page.evaluate(() => {
  const tk = document.querySelector('#nbk[data-take="1"] .nb-take .nb-ttl');
  const m = document.querySelector('#nbk .nb-st > .nb-msg:not(.nb-prep) .nb-ttl');
  return ((tk ?? m) as HTMLElement | null)?.textContent?.trim() ?? '';
});


for (const skin of SKINS) {
  for (const [name, w, h, theme, extra] of [
    ['land-day', 1920, 1080, 'day', ''], ['land-night', 1920, 1080, 'night', ''], ['port-day', 1080, 1920, 'day', ''], ['port-night', 1080, 1920, 'night', ''], ['urgent', 1920, 1080, 'day', 'u'], ['idle', 1920, 1080, 'day', 'i'], ['long', 1920, 1080, 'day', 'l'],
  ] as const) {
    test(`${skin} ${name}`, async ({ page }) => {
      let notices: FeedNotice[] = NORMAL;
      if (extra === 'u') notices = [{ ...CRIT, id: 'u-now', published_at: '2026-10-23T06:11:40Z' }, ...NORMAL];
      if (extra === 'i') notices = [];
      if (extra === 'l') notices = [{ id: 'a', severity: 'info', title: 'עבודות שיפוץ בלובי ובחדרי המדרגות', body: 'בהמשך להחלטת האסיפה הכללית יתחילו עבודות שיפוץ בלובי ובחדרי המדרגות, ויידרשו הדיירים לפנות את הציוד האישי מהמסדרונות. '.repeat(9).trim(), when: 'קבוע', starts_at: '2026-10-20T06:00:00Z', ends_at: null, published_at: null }];
      await open(page, { skin, w, h, theme, notices, logo: true, display: extra === 'l' ? { hold: 'a' } : undefined });
      await page.waitForTimeout(1500);
      await expect(page).toHaveScreenshot(`${skin}-${name}.png`, { maxDiffPixelRatio: 1 });
    });
  }
}
