import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// KAV079-295 ("הרחבת הקברניט", mockup r079 state 8): הגדרות › אוטומציות in demo mode (no backend: api/automations-mock.ts answers) at 1440 / 390 -
// the two new cards ("כפתורי קיר ומתגים", "בדיקות לפני שמירה"), everything OFF by default, a switch reveals its rows, the role table gains the
// "בדיקה על ההתקן" column only with the on-device test on, no horizontal scroll, no platform brand outside the settings vocabulary.
//   SW_BASE_URL=http://127.0.0.1:4711/ npx playwright test tests/evidence-kavarnit-ext.spec.ts --project=desktop --workers=1
// Screenshots: docs/design/evidence/KAV079/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/KAV079');
const SIZES = { '1440': { width: 1440, height: 900 }, '390': { width: 390, height: 844 } } as const;
type Size = keyof typeof SIZES;

async function open(page: Page, size: Size) {
  await page.setViewportSize(SIZES[size]);
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript(() => { try { localStorage.setItem('sw.demo.automations', JSON.stringify({})); } catch { /* storage unavailable */ } });
  await page.goto('about:blank');
  await page.goto('/?design=a#/system/automations');
  await page.waitForSelector('sw-app');
}

const tab = (page: Page) => page.locator('sw-app system-automations');

test('the new cards are there, off by default, and a switch reveals its rows', async ({ page }) => {
  for (const size of ['1440', '390'] as const) {
    await open(page, size);
    const wall = tab(page).locator('[data-card="wall-buttons"]');
    const checks = tab(page).locator('[data-card="prechecks"]');
    await expect(wall).toBeVisible();
    await expect(checks).toBeVisible();
    await expect(wall.locator('[data-setting="wall_double_ms"]')).toHaveCount(0);
    await wall.locator('[data-toggle="wall_buttons_editable"]').click();
    await expect(wall.locator('[data-setting="wall_double_ms"]')).toHaveText(/400/);
    await expect(tab(page).locator('[data-col-device-test]')).toHaveCount(0);
    await checks.locator('[data-toggle="device_test_enabled"]').click();
    await expect(tab(page).locator('[data-col-device-test]')).toHaveCount(1);
    await checks.locator('[data-toggle="precheck_enabled"]').click();
    await expect(checks.locator('[data-setting="conflict_window_min"]')).toHaveText(/10/);
    await expect(checks.locator('[data-seg="button_reuse:warn"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(tab(page).locator('[data-settings-bar]')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    fs.mkdirSync(EVIDENCE, { recursive: true });
    await page.screenshot({ path: path.join(EVIDENCE, `08-settings-${size}.png`), fullPage: false });
  }
});
