import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the kiosk / wall display (T057) against the running developer backend: a saved view is the URL
// (cameras, cols, rotate), pages rotate on a timer, the health pill comes from /health/summary, no admin controls
// are rendered, and offline cameras are never shown as live. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T057-kiosk-live');

test.describe('kiosk wall (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('saved view parameters, rotation, health pill, no admin chrome', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const cams = (await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean; status: string }[];
    const enabled = cams.filter((c) => c.enabled);
    expect(enabled.length).toBeGreaterThan(4);
    await page.goto('/?design=a#/kiosk/all?cols=2&rotate=3');
    await page.waitForSelector('kiosk-wall');
    const wall = page.locator('kiosk-wall');
    await expect(wall.locator('[data-kiosk-tile]')).toHaveCount(4, { timeout: 30000 });
    await expect(wall.locator('[data-kiosk-health]')).toBeVisible({ timeout: 30000 });
    await expect(wall.locator('[data-kiosk-page]')).toContainText('עמוד 1/');
    await expect(page.locator('sw-app')).toHaveAttribute('data-kiosk', '');
    await expect(page.locator('sw-app nav, sw-app [data-sys-pill], sw-app sw-button[icon="settings"]')).toHaveCount(0);
    await page.waitForTimeout(3500);
    await expect(wall.locator('[data-kiosk-page]')).toContainText('עמוד 2/', { timeout: 5000 });
    await page.screenshot({ path: path.join(OUT, `kiosk-rotation-${testInfo.project.name}.png`) });
    const offline = enabled.filter((c) => c.status === 'offline');
    testInfo.annotations.push({ type: 'kiosk', description: `${enabled.length} cameras, ${offline.length} offline, health ${await wall.locator('[data-kiosk-health]').innerText()}` });
    // a saved view of two cameras
    await page.goto(`/?design=a#/kiosk/all?cameras=${enabled[0].id},${enabled[1].id}&cols=2`);
    await page.waitForTimeout(1500);
    await expect(wall.locator('[data-kiosk-tile]')).toHaveCount(2, { timeout: 30000 });
    await expect(wall.locator('[data-kiosk-page]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `kiosk-two-cameras-${testInfo.project.name}.png`) });
    // an offline camera is never a live tile
    for (const c of offline.slice(0, 1)) {
      await page.goto(`/?design=a#/kiosk/all?cameras=${c.id}&cols=1`);
      await page.waitForTimeout(1500);
      const tile = wall.locator('[data-kiosk-tile]').first();
      await expect(tile).toHaveAttribute('state', 'offline', { timeout: 30000 });
      expect(await tile.getAttribute('live')).toBeNull();
    }
  });
});
