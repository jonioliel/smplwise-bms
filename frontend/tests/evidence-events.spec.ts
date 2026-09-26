import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence against the running developer backend and the lab NVR (T032): event pictures grabbed from the
// recordings appear in the event centre rows and drawer, and "נגן כאן" plays the recording inside the drawer.
// Runs only with SW_LIVE=1 (backend on 8099 behind the preview proxy); real Chrome (SW_CHROME=1) for H.264.
const HERE = path.dirname(fileURLToPath(import.meta.url));
// Frames from the owner's cameras are customer data: this evidence stays in the gitignored private-evidence/.
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T032-live');

test.describe('event pictures and inline playback', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('rows carry pictures from the recording; the drawer shows it large and plays from the event', async ({ page, request }, testInfo) => {
    const list = await (await request.get('/api/v1/events?limit=40')).json();
    const withCam = list.events.filter((e: { camera_id: string | null }) => e.camera_id);
    expect(withCam.length).toBeGreaterThan(0);
    // wait (bounded) for the first pictures to exist server-side
    let ready = 0;
    for (let i = 0; i < 20 && ready < 3; i++) {
      const again = await (await request.get('/api/v1/events?limit=40')).json();
      ready = again.events.filter((e: { thumbnail?: string }) => e.thumbnail === 'ready').length;
      if (ready < 3) await page.waitForTimeout(3000);
    }
    expect(ready).toBeGreaterThanOrEqual(1);
    const readyEvent = (await (await request.get('/api/v1/events?limit=40')).json()).events.find((e: { thumbnail?: string }) => e.thumbnail === 'ready');
    const img = await request.get(`/api/v1/events/${readyEvent.id}/thumbnail`);
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toContain('image/jpeg');
    expect((await img.body()).length).toBeGreaterThan(2000);

    await open(page, '/investigate/events');
    await page.waitForTimeout(2500);
    const screen = page.locator('investigate-events');
    const thumbs = screen.locator('sw-table img.thumb');
    await expect(thumbs.first()).toBeVisible();
    await expect.poll(async () => thumbs.first().evaluate((el) => (el as HTMLImageElement).naturalWidth), { timeout: 15000 }).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(OUT, `events-thumbnails-${testInfo.project.name}.png`) });

    // open the row that has a picture and play from the event time inside the drawer
    await screen.locator('sw-table img.thumb').first().click();
    await page.waitForTimeout(800);
    const drawer = screen.locator('sw-drawer');
    await expect(drawer.locator('.big img')).toBeVisible();
    await drawer.locator('sw-button', { hasText: 'נגן כאן' }).click();
    const player = drawer.locator('sw-live-player');
    await expect(player).toBeVisible({ timeout: 15000 });
    await expect.poll(async () => player.evaluate((el) => (el as unknown as { status: string }).status), { timeout: 30000 }).toMatch(/playing|buffering|connecting|live/);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT, `events-inline-playback-${testInfo.project.name}.png`) });
    await drawer.locator('sw-button', { hasText: 'עצור' }).click();
    // the global session list is the wrong thing to check here: other specs in the same run legitimately hold their
    // own playback sessions for a while (some never open a socket at all and only expire ~90 s later through the
    // janitor's never_connected sweep, services/playback.py expire_idle) - a system-wide zero count depends on their
    // timing, not on whether THIS drawer's own player actually stopped (round 10, 2026-09-26: investigated with the
    // sessions endpoint and the backend log - two other specs' preview sessions, not a leak, were still winding
    // down). Check the one thing this test means to prove: its own player is gone from the drawer.
    await expect(player).toHaveCount(0);
  });
});
