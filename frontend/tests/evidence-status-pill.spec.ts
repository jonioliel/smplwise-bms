import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the system status in the top bar (T035): the pill reflects /health/summary (green / amber /
// red with the first problem named), clicking it opens הגדרות → בריאות ועבודות, and a degraded banner
// appears under the top bar only when something is failing. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T033-health-live');

test.describe('system status pill (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('pill matches the summary and opens the health tab', async ({ page, request }, testInfo) => {
    const summary = await (await request.get('/api/v1/health/summary')).json();
    expect(['ok', 'warn', 'error']).toContain(summary.status);
    await open(page, '/explore/sites');
    const pill = page.locator('sw-app [data-sys-pill]');
    await expect(pill).toBeVisible({ timeout: 10000 });
    await expect(pill).toHaveAttribute('data-status', summary.status);
    if (summary.status === 'ok') await expect(pill).toContainText('תקינה');
    else if (summary.status === 'warn') await expect(pill).toContainText('לבדוק');
    else await expect(pill).toContainText('תקלה');
    const banner = page.locator('sw-app [data-sys-banner]');
    if (summary.status === 'error') await expect(banner).toBeVisible();
    else await expect(banner).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `status-pill-${testInfo.project.name}.png`) });
    await pill.click();
    await expect(page).toHaveURL(/#\/system\/diagnostics\?tab=health/);
    await expect(page.locator('system-diagnostics [data-health-card]').first()).toBeVisible({ timeout: 20000 });
  });
});
