import { test, expect, type Page } from '@playwright/test';

// Mobile audit 2026-09-30: touch targets. Measured at 390 and 360 px, sw-button was 26-36 px high, page-level sw-tabs 29-37 px and
// sw-field inputs / selects 30-33 px. Under (max-width: 767px) and (pointer: coarse) they are now sw-button 40 (sm 36, lg 44),
// tabs 44 and fields 40. Demo data, no backend; runs in the "mobile" project (Pixel 7: touch, 390 px). npm run build first.
test.skip(({ hasTouch }) => !hasTouch, 'the phone project (touch)');

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

const h = async (loc: import('@playwright/test').Locator) => Math.round((await loc.boundingBox())!.height);

test('page tab strips are 44 px, buttons 40 px, and a shared field 40 px on a phone', async ({ page }) => {
  await open(page, '/explore/sites');
  for (const b of await page.locator('explore-sites sw-tabs button').all()) expect(await h(b), 'tab').toBeGreaterThanOrEqual(44);
  await open(page, '/explore/buildings/bld-a/floors');
  const open1 = page.locator('explore-floors [data-floor-actions] sw-button').last();
  expect(await open1.evaluate((el) => el.shadowRoot!.querySelector('button')!.getBoundingClientRect().height), 'sw-button').toBeGreaterThanOrEqual(40);
  await open(page, '/live/wall');
  const q = page.locator('live-wall [data-wall-quality]');
  expect(await h(q), 'select in a field').toBeGreaterThanOrEqual(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
