import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Owner decision 2026-09-30: STRUCTURE MANAGEMENT is not possible on a phone (< 768 px), so nobody breaks the structure from
// a small screen: the sites / buildings screen and the floors screen offer no create / edit / delete / plan-upload
// controls, the plan import and plan editor routes show a short state with a way back, and the user menu does not offer
// "עריכת המפה". Viewing and navigation stay. A UX guard, NOT a security boundary (the server enforces permissions).
// Demo data, no backend (npm run build first; the preview serves dist/). One width crossing checks it is resize-aware.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR2-mobile');
const PHONE = { width: 390, height: 780 };
const DESKTOP = { width: 1280, height: 800 };
const GUARD = 'עריכת מבנה וקומות זמינה במחשב בלבד';

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

test.describe('phone: no structure management', () => {
  test('floors screen: only "open the floor" is offered; the desktop keeps every control', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, '/explore/buildings/bld-a/floors');
    const floors = page.locator('explore-floors');
    await expect(floors.locator('sw-button', { hasText: 'קומה חדשה' })).toHaveCount(1);
    await expect(floors.locator('sw-button', { hasText: 'מבנה חדש' })).toHaveCount(1);
    await expect(floors.locator('sw-button', { hasText: 'מחיקה' })).toHaveCount(1);
    await expect(floors.locator('sw-button', { hasText: /העלאת תוכנית|תוכנית חדשה/ })).toHaveCount(1);

    // crossing into the phone width removes them live (no reload)
    await page.setViewportSize(PHONE);
    await expect(floors.locator('sw-button', { hasText: 'קומה חדשה' })).toHaveCount(0);
    for (const label of ['מבנה חדש', 'עריכה', 'מחיקה', 'העלאת תוכנית', 'תוכנית חדשה']) {
      await expect(floors.locator('[data-floor-actions] sw-button', { hasText: label })).toHaveCount(0);
    }
    await expect(floors.locator('[data-floor-actions] sw-button', { hasText: 'פתח את' })).toHaveCount(1);
    await shot(page, 'structure-floors-phone');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  });

  test('sites screen: no new-site / new-building / edit / delete controls', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await open(page, '/explore/sites');
    const sites = page.locator('explore-sites');
    await expect(sites.locator('sw-card[data-site-card]').first()).toBeVisible();
    await expect(sites.locator('sw-button[label="מבנה חדש"]').first()).toBeVisible();
    await page.setViewportSize(PHONE);
    await expect(sites.locator('sw-button[label="מבנה חדש"]')).toHaveCount(0);
    await expect(sites.locator('[data-add-building], [data-edit], [data-delete], button.add')).toHaveCount(0);
    await expect(sites.locator('sw-button', { hasText: 'אתר חדש' })).toHaveCount(0);
    await expect(sites.locator('sw-card[data-site-card]').first()).toBeVisible(); // viewing stays
    await shot(page, 'structure-sites-phone');
  });

  test('plan editor and plan import routes show the desktop-only state with a way back', async ({ page }) => {
    await page.setViewportSize(PHONE);
    for (const route of ['/explore/floors/f0/edit', '/explore/floors/f-2/import']) {
      await open(page, route);
      const guard = page.locator('sw-app [data-desktop-only="structure"]');
      await expect(guard).toBeVisible();
      await expect(guard).toContainText(GUARD);
      await expect(page.locator('sw-app explore-plan-editor, sw-app explore-plan-import')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      const back = guard.locator('[data-desktop-only-back]');
      const box = (await back.boundingBox())!;
      expect(box.height, 'the way back is a touch-sized target').toBeGreaterThanOrEqual(36);
    }
    await open(page, '/explore/floors/f0/edit');
    await shot(page, 'structure-editor-phone');
    await page.locator('sw-app [data-desktop-only-back]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/explore/floors/f0');
    await expect(page.locator('sw-app explore-floor-map')).toHaveCount(1); // viewing stays available

    // the same route on a desktop width is the editor
    await page.setViewportSize(DESKTOP);
    await open(page, '/explore/floors/f0/edit');
    await expect(page.locator('sw-app [data-desktop-only]')).toHaveCount(0);
    await expect(page.locator('sw-app explore-plan-editor')).toHaveCount(1);
  });

  test('the user menu does not offer "עריכת המפה" on a phone', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await open(page, '/explore/floors/f0');
    await expect(page.locator('sw-app explore-floor-map sw-plan-canvas')).toBeVisible();
    await page.locator('sw-app [data-nav-me]').click();
    await expect(page.locator('sw-app sw-user-menu [data-user-menu]')).toBeVisible();
    await expect(page.locator('sw-app sw-user-menu [data-menu-screen-edit="floor-map-edit"]')).toHaveCount(0);
    await shot(page, 'structure-user-menu-phone');
  });
});
