import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T007 (R013/R014): build screenshots per reference width, RTL shell, all map states,
// camera and entity drawers. Output: docs/evidence/T007/<name>-<project>.png
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'docs', 'evidence', 'T007');

async function open(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(250);
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

test.describe('T007 design baseline', () => {
  test('shell is RTL Hebrew', async ({ page }) => {
    await open(page, '/explore/floors/f0');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('he');
    await noHorizontalOverflow(page);
  });

  for (const state of ['ready', 'loading', 'error', 'forbidden', 'stale', 'partial'] as const) {
    test(`floor map — ${state}`, async ({ page }, testInfo) => {
      await open(page, `/explore/floors/f0?state=${state}`);
      await page.screenshot({ path: path.join(OUT, `sc04-floor-map-${state}-${testInfo.project.name}.png`) });
      await noHorizontalOverflow(page);
    });
  }

  test('floor without a plan (empty state)', async ({ page }, testInfo) => {
    await open(page, '/explore/floors/f-2');
    await expect(page.getByText('לקומה הזו עדיין אין תוכנית')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `sc04-floor-map-empty-${testInfo.project.name}.png`) });
  });

  test('camera drawer opens from a marker and never mirrors the plan', async ({ page }, testInfo) => {
    await open(page, '/explore/floors/f0');
    const canvas = page.locator('sw-plan-canvas');
    expect(await canvas.evaluate((el) => getComputedStyle(el).direction)).toBe('ltr');
    await page.getByRole('button', { name: 'כניסה ראשית' }).click();
    await expect(page.getByRole('dialog', { name: 'כניסה ראשית' })).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `sc04-camera-drawer-${testInfo.project.name}.png`) });
    await noHorizontalOverflow(page);
  });

  test('offline camera explains itself', async ({ page }, testInfo) => {
    await open(page, '/explore/floors/f0');
    await page.getByRole('button', { name: 'מסדרון מזרחי' }).click();
    await expect(page.getByText('המצלמה אינה מחוברת ל־NVR')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `sc04-camera-offline-${testInfo.project.name}.png`) });
  });

  test('entity drawer shows state and permission-gated control', async ({ page }, testInfo) => {
    await open(page, '/explore/floors/f0');
    await page.getByRole('button', { name: 'דלת כניסה' }).click();
    await expect(page.getByRole('dialog', { name: 'דלת כניסה' })).toBeVisible();
    await expect(page.getByText('אין הרשאה לשליטה')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `sc10-entity-drawer-${testInfo.project.name}.png`) });
  });

  test('style guide', async ({ page }, testInfo) => {
    await open(page, '/styleguide');
    await page.screenshot({ path: path.join(OUT, `styleguide-${testInfo.project.name}.png`), fullPage: true });
    await noHorizontalOverflow(page);
  });
});
