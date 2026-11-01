import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installGeneratorMock, url as genUrl } from './generator-mocks';
import { installElectricityMock, url as elecUrl } from './electricity-mocks';
import { installFleetMock, fleetUrl } from './fleet-mocks';

// INSIGHTS-POLISH-2331: the review screenshots of the infrastructure shells and the health report (generator, electricity, water, fleet report)
// at the five review widths, from the REAL build against the existing mock layers (fake data only). The insight screens themselves are shot by
// the `shots` test of evidence-insights.spec.ts (its mock is local to that file). Skipped unless SW_SHOTS_DIR is set:
//   SW_BASE_URL=http://127.0.0.1:<port>/ SW_SHOTS_DIR=<dir> npx playwright test tests/evidence-insights-polish-2331.spec.ts --project=desktop --workers=1
const WIDTHS = [1920, 1440, 1180, 1024, 390] as const;

async function settle(page: Page, wait: string): Promise<void> {
  await page.waitForSelector(wait, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

test('shots: generator, electricity and water shells, fleet report', async ({ page }) => {
  const dir = process.env.SW_SHOTS_DIR;
  test.skip(!dir, 'SW_SHOTS_DIR not set');
  test.setTimeout(240_000);
  fs.mkdirSync(dir!, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: w < 600 ? 844 : w <= 1024 ? 768 : 900 });
    const scheme = w < 600 ? 'dark' : 'light';
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installGeneratorMock(page, { count: 2 });
    await page.goto('about:blank');
    await page.goto(genUrl('/infra/generator/live', 'classic', scheme));
    await settle(page, 'sw-app infra-generator gen-live-page');
    await page.screenshot({ path: path.join(dir!, `generator-${w}-${scheme}.png`) });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installGeneratorMock(page, { count: 0 });
    await page.goto('about:blank');
    await page.goto(genUrl('/infra/generator/live', 'classic', scheme));
    await settle(page, 'sw-app infra-generator [data-state="not-found"]');
    await page.screenshot({ path: path.join(dir!, `generator-none-${w}-${scheme}.png`) });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installElectricityMock(page, {});
    await page.goto('about:blank');
    await page.goto(elecUrl('/infra/electricity/meters', 'classic', scheme));
    await settle(page, 'sw-app elec-meters-page [data-state="ready"]');
    await page.screenshot({ path: path.join(dir!, `electricity-${w}-${scheme}.png`) });
    await page.goto('about:blank');
    await page.goto(elecUrl('/infra/water/meters', 'classic', scheme));
    await settle(page, 'sw-app infra-water [data-state]');
    await page.screenshot({ path: path.join(dir!, `water-${w}-${scheme}.png`) });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installFleetMock(page, { scene: 'on' });
    await page.goto('about:blank');
    await page.goto(fleetUrl('classic', scheme));
    await settle(page, 'sw-app system-fleet-report [data-fleet-report][data-state="ready"]');
    await page.screenshot({ path: path.join(dir!, `fleet-${w}-${scheme}.png`), fullPage: true });
  }
});
