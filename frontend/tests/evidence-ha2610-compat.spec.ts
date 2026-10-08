import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// HA 2026.10 compatibility (docs/operations/HA_2026_10_COMPATIBILITY_HE.md plan row 4): the administrator-only card on
// Settings > Automations (`#/system/automations`) that lists what the read-only scan found. Demo mode (no backend: the mock store
// answers; `compat: true` in localStorage `sw.demo.automations` stages two automations and one script), RTL, 1440 / 390 (the settings screens keep the installation's theme; the demo's `scheme` control is for the device screens).
// The card is absent when nothing is found (the default demo) and the screen is forbidden to a non-administrator.
//   SW_BASE_URL=http://127.0.0.1:4711/ npx playwright test tests/evidence-ha2610-compat.spec.ts --project=desktop --workers=1
// Screenshots: docs/design/evidence/HA2610/.

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/HA2610');
const SIZES = { '1440': { width: 1440, height: 900 }, '390': { width: 390, height: 844 } } as const;
type Size = keyof typeof SIZES;

async function open(page: Page, size: Size, control: Record<string, unknown>) {
  await page.setViewportSize(SIZES[size]);
  await page.route('**/api/v1/**', (route) => route.abort());  // demo mode whatever runs behind the preview
  await page.addInitScript((c) => {
    try { localStorage.setItem('sw.demo.automations', JSON.stringify(c)); } catch { /* storage unavailable */ }
  }, control);
  await page.goto('about:blank');
  await page.goto('/?design=a#/system/automations');
  await page.waitForSelector('sw-app');
}

test.describe('HA 2026.10 compatibility card', () => {
  test.beforeAll(() => fs.mkdirSync(EVIDENCE, { recursive: true }));

  for (const size of ['1440', '390'] as const) {
    {
      test(`findings ${size}`, async ({ page }) => {
        await open(page, size, { compat: true });
        const card = page.locator('[data-card="compat"]');
        await expect(card).toBeVisible();
        await expect(card.locator('[data-compat]')).toHaveCount(3);
        await expect(card.locator('[data-compat-summary]')).toContainText('3 פריטים דורשים תיקון לפני השדרוג');
        await expect(card.locator('[data-compat="automation:demo-compat-1"] [data-compat-code="state_for_list"]')).toHaveText('"במשך" עם כמה מצבים');
        await expect(card.locator('[data-compat="automation:demo-compat-2"] [data-compat-code]')).toHaveCount(2);
        const script = card.locator('[data-compat="script:arm_alarm_mqtt"]');
        await expect(script.locator('[data-compat-code="admin_only_service"]')).toHaveText('הפעלה ידנית למנהל בלבד');
        await expect(script).toContainText('mqtt.publish');
        await expect(script.locator('a')).toHaveAttribute('href', '#/devices/automations/scripts/arm_alarm_mqtt');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(EVIDENCE, `compat-${size}.png`), fullPage: false });
      });
    }
  }

  test('no card when nothing is found', async ({ page }) => {
    await open(page, '1440', {});
    await expect(page.locator('[data-automations-settings]')).toBeVisible();
    await expect(page.locator('[data-card="compat"]')).toHaveCount(0);
  });

  test('a non-administrator never sees it', async ({ page }) => {
    await open(page, '1440', { compat: true, user: 'runner' });
    await expect(page.locator('[data-automations-settings-forbidden]')).toBeVisible();
    await expect(page.locator('[data-card="compat"]')).toHaveCount(0);
  });
});
