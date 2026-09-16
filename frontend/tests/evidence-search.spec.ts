import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the global search (design M48, pilot scope) against the running developer backend: Ctrl+K
// focuses the top-bar search, typing lists rooms / cameras / floors / entities with their place, choosing a
// room opens its floor with the room highlighted and zoomed, choosing a camera opens its card on the map.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T007-search-live');

test.describe('global search (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('ctrl+k, room hit opens the floor zoomed, camera hit opens its card', async ({ page, request }, testInfo) => {
    const zones = (await (await request.get('/api/v1/search?q=לובי')).json()).results.filter((r: { kind: string }) => r.kind === 'zone');
    expect(zones.length, 'a searchable room named לובי… must exist (created by the zones evidence)').toBeGreaterThan(0);
    const cams = (await (await request.get('/api/v1/search?q=כניסה')).json()).results.filter((r: { kind: string }) => r.kind === 'camera');
    expect(cams.length).toBeGreaterThan(0);

    await open(page, '/explore/sites');
    await page.keyboard.press('Control+k');
    const focused = await page.evaluate(() => {
      const app = document.querySelector('sw-app');
      const el = app?.shadowRoot?.activeElement as HTMLElement | null;
      return el?.tagName === 'INPUT' && (el as HTMLInputElement).type === 'search';
    });
    expect(focused).toBeTruthy();

    // 1) rooms: type, see the hit with its floor, open it
    await page.keyboard.type('לובי');
    const results = page.locator('sw-app .results');
    await expect(results).toBeVisible({ timeout: 10000 });
    const zoneRow = results.locator('.row', { hasText: zones[0].title }).first();
    await expect(zoneRow).toBeVisible();
    await expect(zoneRow).toContainText('חדר / אזור');
    await page.screenshot({ path: path.join(OUT, `search-results-${testInfo.project.name}.png`) });
    await zoneRow.click();
    await expect(page).toHaveURL(/#\/explore\/floors\/[a-z0-9-]+\?zone=/);
    const viewer = page.locator('explore-floor-map');
    const canvas = viewer.locator('sw-plan-canvas');
    await expect(canvas.locator('g.zone.selected')).toHaveCount(1, { timeout: 15000 });
    await page.waitForTimeout(600);
    const zoom = await canvas.evaluate((el) => (el as unknown as { zoom: number }).zoom);
    expect(zoom).toBeGreaterThan(0.3); // zoomed in on the room, not the whole-plan fit (~0.29 on the owner's plan)
    await page.screenshot({ path: path.join(OUT, `search-zone-${testInfo.project.name}.png`) });

    // 2) cameras: a hit opens the camera card on its floor (or the live view when unplaced)
    await page.keyboard.press('Control+k');
    await page.keyboard.type('כניסה');
    const camRow = page.locator('sw-app .results .row', { hasText: 'מצלמה' }).first();
    await expect(camRow).toBeVisible({ timeout: 10000 });
    await camRow.click();
    if (cams[0].route.includes('?camera=')) {
      await expect(page).toHaveURL(/\?camera=/);
      await expect(page.locator('explore-floor-map sw-popover, explore-floor-map sw-drawer').first()).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, `search-camera-${testInfo.project.name}.png`) });
    } else {
      await expect(page).toHaveURL(/#\/live\/cameras\//);
    }

    // 3) keyboard: Escape closes the list
    await page.keyboard.press('Control+k');
    await page.keyboard.type('קומה');
    await expect(page.locator('sw-app .results')).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('sw-app .results')).toHaveCount(0);
  });
});
