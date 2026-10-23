import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERMS, installGeneratorMock, url } from './generator-mocks';

// GENLOG092-295 evidence: Infrastructure > Generator > run log from the REAL build against the generator mock layer (fake data only), and the
// run-log section of the generator settings. The page is behind a default-off switch: off = no page row entry and a calm state.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-genlog-092.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/generator');
const S = 'sw-app infra-generator';
const noScroll = async (page: Page) => {
  const [sw, cw, sh, ch] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, document.documentElement.scrollHeight, document.documentElement.clientHeight]);
  expect(sw - cw).toBeLessThanOrEqual(1); // never sideways
  return sh - ch;
};

test.describe('generator run log', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  test('switch off: no run-log page in the row, the direct link shows a calm state', async ({ page }) => {
    await installGeneratorMock(page, { perms: PERMS.view });
    await page.goto(url('/infra/generator/live'));
    await expect(page.locator(`${S} [data-gen-shell]`)).toBeVisible();
    await expect(page.locator(`${S} sw-tabs[data-infra-pages]`)).not.toContainText('יומן הפעלות');
    await page.goto(url('/infra/generator/log'));
    await expect(page.locator(`${S} [data-state="log-off"]`)).toBeVisible();
    await expect(page.locator(`${S} gen-log-page`)).toHaveCount(0);
  });

  test('switch on: summary, the run in progress, one page of runs with a pager, fuel events', async ({ page }) => {
    const mock = await installGeneratorMock(page, { perms: PERMS.view, log: true });
    await page.goto(url('/infra/generator/log'));
    const lg = page.locator(`${S} gen-log-page [data-gen-log]`);
    await expect(lg).toBeVisible();
    await expect(page.locator(`${S} sw-tabs[data-infra-pages]`)).toContainText('יומן הפעלות');
    await expect(lg.locator('[data-kpi="runs"] .v')).toHaveText('11');
    await expect(lg.locator('[data-log-current]')).toContainText('הפסקת רשת');
    await expect(lg.locator('[data-run]')).toHaveCount(8);
    await expect(lg.locator('[data-run="r0"] [data-kind="mains_failure"]')).toBeVisible();
    await expect(lg.locator('[data-fuel="refill"]')).toBeVisible();
    await expect(lg).not.toContainText('sensor.');
    if (test.info().project.name !== 'mobile') expect(await noScroll(page)).toBeLessThanOrEqual(1); // the control screen fits the viewport
    else await noScroll(page);
    await page.screenshot({ path: path.join(OUT, `run-log-${test.info().project.name}-light.png`) });
    await lg.locator('[data-log-next]').click();
    await expect(lg.locator('[data-run]')).toHaveCount(3);
    expect(mock.calls.some((c) => c.path.includes('/runs') && c.path.includes('page=2'))).toBe(true);
    expect(mock.calls.every((c) => c.method === 'GET' || !c.path.includes('/runs'))).toBe(true); // read only
  });

  test('settings: the run-log section shows the switch and every threshold', async ({ page }) => {
    await installGeneratorMock(page, { perms: PERMS.manage, log: true });
    await page.goto(url('/system/infra/generator/log'));
    const s = page.locator('sw-app gen-settings [data-section="log"]');
    await expect(s).toBeVisible();
    await expect(s.locator('[data-log-enabled]')).toBeChecked();
    await expect(s.locator('[data-log-set]')).toHaveCount(3);
    await expect(s.locator('[data-log-set="min_run_s"]')).toHaveValue('60');
  });
});
