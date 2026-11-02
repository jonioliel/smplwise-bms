import { test, expect, type Page } from '@playwright/test';
import { installGeneratorMock, PERMS, url } from './generator-mocks';
import { open as elOpen, screen as elScreen, EL } from './electricity-ui';

// POLISH4-WP5 capture (temporary, never merged): screenshots of the multimedia groups / screens pages, the generator pages and the
// electricity account / bill pages at the owner's five widths, through toHaveScreenshot so `run_smart.py ... -u` copies the PNGs back.
const SIZES: [number, number][] = [[1920, 1080], [1440, 900], [1180, 820], [1024, 768], [390, 844]];
const ONLY = (process.env.WP5_W || '390').split(',').filter(Boolean).map(Number);
const sizes = ONLY.length ? SIZES.filter(([w]) => ONLY.includes(w)) : SIZES;
const SCHEMES = (process.env.WP5_S || 'light').split(',') as ('light' | 'dark')[];
const S = 'sw-app infra-generator';

async function snap(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', maxDiffPixelRatio: 1, threshold: 1 });
}

test.describe.configure({ mode: 'serial' });

test('media pages', async ({ page }) => {
  test.setTimeout(240_000);
  for (const scheme of SCHEMES) {
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      for (const [name, hash] of [['groups', '/multimedia/groups'], ['groups-edit', '/multimedia/groups?edit=1'], ['screens', '/multimedia/screens'], ['cast', '/multimedia/cast']] as const) {
        await page.goto('about:blank');
        await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=${scheme}#${hash}`);
        await page.waitForSelector('sw-app');
        await page.waitForTimeout(1400);
        await snap(page, `wp5-${name}-${w}-${scheme}`);
      }
    }
  }
});

test('generator pages', async ({ page }) => {
  test.setTimeout(300_000);
  for (const scheme of SCHEMES) {
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      const pages: [string, string, string][] = [
        ['live', '/infra/generator/live', `${S} [data-gen-live] [data-gauge="oil_pressure"]`],
        ['alerts', '/infra/generator/alerts', `${S} [data-gen-alerts]`],
        ['history', '/infra/generator/history', `${S} [data-gen-alerts]`],
        ['charts', '/infra/generator/charts', `${S} gen-chart-set [data-chart]`],
        ['log', '/infra/generator/log', `${S} [data-gen-log]`],
      ];
      for (const [name, hash, wait] of pages) {
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await installGeneratorMock(page, { perms: PERMS.manage, level: 'full', log: true, count: 2 });
        await page.goto('about:blank');
        await page.goto(url(hash, 'classic', scheme));
        await page.waitForSelector(wait, { timeout: 20_000 });
        await snap(page, `wp5-gen-${name}-${w}-${scheme}`);
      }
    }
  }
});

test('electricity pages', async ({ page }) => {
  test.setTimeout(300_000);
  for (const scheme of SCHEMES) {
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      const pages: [string, string, string][] = [
        ['account', `${EL}/accounts/a1`, 'account'],
        ['account-history', `${EL}/accounts/a1/history`, 'account'],
        ['account-bills', `${EL}/accounts/a1/bills`, 'account'],
        ['bill', `${EL}/bills/b104`, 'bill'],
        ['wizard', `${EL}/accounts/new`, 'wizard'],
        ['accounts', `${EL}/accounts`, 'accounts'],
      ];
      for (const [name, route, scr] of pages) {
        await elOpen(page, route, { scheme });
        await elScreen(page, scr);
        await snap(page, `wp5-el-${name}-${w}-${scheme}`);
      }
    }
  }
});
