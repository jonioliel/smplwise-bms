import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T049 bookmarks on the timeline (0.1.57) against the running developer backend: the day's case items
// of the camera show as flags on the playback timeline, a flag click names the case, and Alt + click on the track
// opens the case picker for a new bookmark that then appears as a second flag. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T049-cases-live');

const isoSec = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

test.describe('timeline bookmarks (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('flags on the timeline, a flag click names the case, Alt+click bookmarks another instant', async ({ page, request }, testInfo) => {
    test.setTimeout(150000);
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean; status: string }[]).filter((c) => c.enabled);
    const cam = cams.find((c) => c.status === 'online') ?? cams[0];
    expect(cam, 'an enabled camera').toBeTruthy();
    const tz = ((await (await request.get('/api/v1/settings')).json()).settings['time.zone'] as string) ?? 'Asia/Jerusalem';
    // twenty minutes ago: recorded already, and (bar a run right after midnight) inside today's local day
    const at = new Date(Date.now() - 20 * 60 * 1000);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
    const title = `T049 סימניות ${Date.now()}`;
    const c = await (await request.post('/api/v1/cases', { data: { title } })).json();
    const item = await (await request.post(`/api/v1/cases/${c.id}/items`, { data: { kind: 'clip', camera_id: cam.id, from_at: isoSec(new Date(at.getTime() - 10000)), to_at: isoSec(new Date(at.getTime() + 20000)), note: 'דלת' } })).json();
    expect(item.id, 'the bookmark item').toBeTruthy();
    try {
      // the API lists it for the camera and the day
      const listed = (await (await request.get(`/api/v1/cases/bookmarks?camera_id=${cam.id}&date=${date}`)).json()).bookmarks as { id: string; preservation: string }[];
      expect(listed.map((b) => b.id)).toContain(item.id);
      expect(listed.find((b) => b.id === item.id)!.preservation).toBe('nvr');

      await page.goto(`/?design=a#/investigate/playback?camera=${cam.id}&date=${date}`);
      const pb = page.locator('investigate-playback');
      await expect(pb.locator('[data-add-to-case]')).toBeVisible({ timeout: 20000 });
      await expect(pb.locator('[data-bookmarks-count]')).toContainText('סימני', { timeout: 20000 });
      // the whole day on the track, so the flag is in view wherever the cursor follows
      await pb.locator('sw-timeline button', { hasText: 'יום' }).click();
      const flag = pb.locator(`sw-timeline g[data-bookmark="${item.id}"]`);
      await expect(flag).toHaveCount(1);
      await expect(flag).toHaveAttribute('aria-label', /דלת/);
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, `bookmarks-flags-${testInfo.project.name}.png`) });

      // a flag click names the case (and seeks the track to it); the head of the flag is the click target
      await flag.locator('polygon').click({ timeout: 10000 });
      const active = pb.locator('[data-bookmark-active]');
      await expect(active).toContainText(title);
      await expect(active).toContainText('דלת');
      await expect(active).toContainText('סימנייה ל־NVR');

      // Alt + click on the track (at the flag's instant, lower on the track) opens the case picker for a new bookmark
      const track = pb.locator('sw-timeline svg[role="img"]');
      const tb = (await track.boundingBox())!;
      const fb = (await flag.boundingBox())!;
      await page.keyboard.down('Alt');
      await page.mouse.click(fb.x + 3, tb.y + tb.height * 0.62);
      await page.keyboard.up('Alt');
      const picker = pb.locator('sw-case-picker');
      await expect(picker.locator('[data-case-select]')).toBeVisible({ timeout: 15000 });
      await page.screenshot({ path: path.join(OUT, `bookmarks-alt-click-${testInfo.project.name}.png`) });
      await picker.locator('[data-case-select]').selectOption(c.id);
      await picker.locator('[data-case-confirm]').click();
      await expect(picker.locator('[data-case-added]')).toBeVisible({ timeout: 15000 });
      // the new bookmark is on the track at once
      await expect(pb.locator('sw-timeline g[data-bookmark]')).toHaveCount(2, { timeout: 15000 });
      const items = (await (await request.get(`/api/v1/cases/${c.id}?check=false`)).json()).items as { kind: string; note: string; from_at: string; to_at: string }[];
      const added = items.find((i) => i.note === 'סימנייה');
      expect(added, 'the Alt+click bookmark in the case').toBeTruthy();
      expect(new Date(added!.to_at).getTime() - new Date(added!.from_at).getTime()).toBe(30000);
      await page.screenshot({ path: path.join(OUT, `bookmarks-two-flags-${testInfo.project.name}.png`) });
    } finally {
      const del = await request.delete(`/api/v1/cases/${c.id}`);
      expect([200, 204]).toContain(del.status());
    }
  });
});
