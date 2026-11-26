import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mockHonestArea, openBuilding } from './area-honest-count-2540-mocks';

// AREA-HONEST-COUNT-2540: the before / after captures of the compare page (private/planning/area_honest_count_2540_compare_2026-11-26.html).
// Runs only with SW_SHOTS=<dir>; SW_SHOTS_TAG=before (the base build, served the base server's counts) or after (this branch).
const DIR = process.env.SW_SHOTS ?? '';
const TAG = process.env.SW_SHOTS_TAG === 'before' ? 'before' : 'after';

async function shoot(page: Page, name: string, info: { project: { name: string } }) {
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: path.join(DIR, `${TAG}-${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`) });
}

test.describe('compare captures', () => {
  test.skip(!DIR, 'SW_SHOTS only');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });
  for (const scheme of ['light', 'dark'] as const) {
    test(`building rows ${scheme}`, async ({ page }, info) => {
      await mockHonestArea(page, { scheme, legacy: TAG === 'before' });
      await openBuilding(page, scheme);
      await page.waitForTimeout(600);
      await shoot(page, `rows-${scheme}`, info);
      const card = page.locator('sw-app devices-building section[data-floor-card="ahc_g"]');
      fs.mkdirSync(DIR, { recursive: true });
      await card.screenshot({ path: path.join(DIR, `${TAG}-card-${scheme}-${info.project.name === 'mobile' ? '390' : '1440'}.png`) });
    });
  }
  test('area summary popover', async ({ page }, info) => {
    await mockHonestArea(page, { legacy: TAG === 'before' });
    await openBuilding(page);
    const wide = (page.viewportSize()?.width ?? 1440) >= 900;
    const menu = page.locator(`sw-app devices-building devices-bulk-menu[${wide ? 'data-tree-area' : 'data-card-area'}="ahc_entry"]`);
    await menu.locator('[data-area-more]').click();
    await page.waitForTimeout(500);
    await shoot(page, 'popover', info);
  });
});
