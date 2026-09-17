import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T044 hover preview on event rows (0.1.60) against the running developer backend: hovering an event's
// thumbnail opens a floating strip with the frames 5 s before, at and 5 s after the event, taken from the recording.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T044-hover-live');

test.describe('event row hover preview (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('hovering a thumbnail shows three frames from the recording', async ({ page, request }, testInfo) => {
    test.setTimeout(120000);
    const list = await (await request.get('/api/v1/events?limit=60')).json();
    // thumbnails are grabbed lazily once the list renders; pick an event with a camera whose grab is possible
    const ev = (list.events as { id: string; camera_id: string | null; thumbnail: string; occurred_at: string }[]).find((e) => e.camera_id && e.thumbnail !== 'unavailable' && Date.now() - new Date(e.occurred_at).getTime() > 90000);
    expect(ev, 'an event with a camera, at least 90 s old').toBeTruthy();
    const date = ev!.occurred_at.slice(0, 10);
    await page.goto(`/?design=a#/investigate/events?date=${date}`);
    const screen = page.locator('investigate-events');
    const thumb = screen.locator(`img[data-thumb="${ev!.id}"]`).first();
    await expect(thumb).toBeVisible({ timeout: 90000 }); // the grab from the recording can take a while on the lab NVR
    await thumb.scrollIntoViewIfNeeded();
    await thumb.hover();
    const card = screen.locator('[data-row-preview]');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card.locator('.cell')).toHaveCount(3);
    await expect(card).toContainText('5 שניות לפני ואחרי');
    // the frames come from the recording: wait until each cell resolved to an image or an honest "אין פריים"
    await expect.poll(async () => card.locator('.cell').evaluateAll((cells) => cells.every((c) => {
      const img = c.querySelector('img') as HTMLImageElement | null;
      return (img && img.complete && img.naturalWidth > 0) || !!c.textContent?.includes('אין פריים');
    })), { timeout: 45000 }).toBe(true);
    const loaded = await card.locator('img').evaluateAll((imgs) => imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length);
    testInfo.annotations.push({ type: 'frames', description: `${loaded} of 3 frames decoded` });
    expect(loaded, 'at least the event frame itself').toBeGreaterThan(0);
    await page.screenshot({ path: path.join(OUT, `hover-${testInfo.project.name}.png`) });
    // leaving the thumbnail closes the card
    await page.mouse.move(5, 5);
    await expect(card).toHaveCount(0, { timeout: 3000 });
  });
});
