import { test } from '@playwright/test';
import { installElectricityMock, PERMS, url } from './electricity-mocks';

test('debug picker row', async ({ page }) => {
  await installElectricityMock(page, { perms: PERMS.bills });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url('/infra/electricity/meters?add=1', 'classic', 'light'));
  await page.locator('sw-app elec-meters-page [data-picker-item="sensor.bakery_daily"]').waitFor();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '../docs/design/evidence/electricity-ui-meters/debug-row-320.png' });
  await page.setViewportSize({ width: 820, height: 1100 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '../docs/design/evidence/electricity-ui-meters/debug-row-820.png' });
});
