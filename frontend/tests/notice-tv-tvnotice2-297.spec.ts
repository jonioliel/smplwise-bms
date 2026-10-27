import { test, expect, type Page } from '@playwright/test';
import { LOBBY_NOTICES, lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import type { Display, FeedNotice } from '../src/notice-tv/tv-logic';

// TVNOTICE2-297 (owner 27.10): the "updated" line in both wordings (the preview wording "עודכן · <place> <time>" is the default) and
// the idle board (no notice to show) with SmplWise only by default or with the developer logo too. Structure only (no pixel baselines).
//   npx playwright test tests/notice-tv-tvnotice2-297.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><rect width="300" height="100" fill="#1e2e47"/></svg>';
let opened = 0;

async function open(page: Page, display: Partial<Display>, notices: FeedNotice[] = LOBBY_NOTICES, logo = true) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const feed = lobbyFeed(display, notices);
  if (logo) {
    feed.board.logos = { company: 'api/v1/notices/display/lobby/logo/company?variant=light&v=aaaaaaaaaaaaaaaa' };
    feed.board.brand = { size: 'm', dark_mode: 'plate', name: 'מגדל הים' };
  }
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  if (logo) await page.route('**/api/v1/notices/display/lobby/logo/company**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: LOGO }));
  await serveFeed(page, feed);
  await page.goto(new URL(tvUrl('n=' + ++opened), base()).toString());
  await page.waitForSelector('#cv[data-tpl] .pg .hd', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(800);
}

for (const hdr of ['a', 'c'] as const) {
  test(`the "updated" line: the preview wording by default, the old wording on request (header ${hdr})`, async ({ page }) => {
    const live = hdr === 'c' ? '#cv .pg .ft .live' : '#cv .pg .hd .live';
    await open(page, { header: hdr }); // no own value: the TV reads the preview wording
    await expect(page.locator('#cv')).toHaveAttribute('data-updated', 'place');
    await expect(page.locator(live)).toHaveText('עודכן · הכניסה הראשית 09:12');
    await open(page, { header: hdr, updated: 'full' });
    await expect(page.locator(live)).toHaveText('עודכן 09:12 · לוח הלובי');
    await open(page, { header: hdr, updated: 'place', place: '' }); // no place: the board name stands in
    await expect(page.locator(live)).toHaveText('עודכן · לוח הלובי 09:12');
  });
}

test('the idle board: SmplWise only by default, the developer logo too on request', async ({ page }) => {
  await open(page, {}, []);
  await expect(page.locator('#cv')).toHaveAttribute('data-empty', '1');
  await expect(page.locator('#cv')).toHaveAttribute('data-idle-logo', 'sw');
  await expect(page.locator('#cv .empty .idl')).toHaveCount(0);
  await open(page, { idle_logo: 'both' }, []);
  await expect(page.locator('#cv .empty .idl .lg.company img')).toBeVisible();
  // the message stays below the logo and inside the canvas, no scroll
  const fits = await page.evaluate(() => {
    const cv = (document.getElementById('cv') as HTMLElement).getBoundingClientRect();
    const r = (document.querySelector('#cv .empty .idl') as HTMLElement).getBoundingClientRect();
    const p = (document.querySelector('#cv .empty p') as HTMLElement).getBoundingClientRect();
    return r.top >= cv.top && r.bottom <= p.top + 1 && document.documentElement.scrollHeight <= innerHeight + 1;
  });
  expect(fits).toBe(true);
  // explicit choice: shown even when the header's company-logo block is off
  await open(page, { idle_logo: 'both', blocks: { company_logo: false } as Display['blocks'] }, []);
  await expect(page.locator('#cv .empty .idl .lg.company img')).toBeVisible();
  // no company logo uploaded: nothing to add
  await open(page, { idle_logo: 'both' }, [], false);
  await expect(page.locator('#cv .empty .idl')).toHaveCount(0);
  // with notices on the board, the idle message (and its logo) is hidden
  await open(page, { idle_logo: 'both' });
  await expect(page.locator('#cv .empty')).toBeHidden();
});
