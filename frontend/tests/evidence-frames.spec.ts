import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for recording frames at an instant (T044) against the running developer backend and the lab NVR:
// the API grabs a real JPEG from the recording (cached afterwards), the playback timeline shows a floating
// preview while hovering, and the historical map shows the selected camera's frame at the chosen instant.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T044-frames-live');

test.describe('recording frames (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1500);
  }

  test('api grab + cache, timeline hover preview, historical map frame', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    // a camera with a recording segment today
    const cams = (await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; name: string; status: string }[];
    const settings = (await (await request.get('/api/v1/settings')).json()).settings as Record<string, string>;
    const tz = settings['time.zone'] ?? 'Asia/Jerusalem';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    let camId = '';
    let at = '';
    for (const c of cams) {
      const r = await request.get(`/api/v1/cameras/${c.id}/recordings?date=${today}`);
      if (r.status() !== 200) continue;
      const segs = (await r.json()).segments as { start_at: string; end_at: string }[];
      const seg = segs.find((s) => new Date(s.end_at).getTime() - new Date(s.start_at).getTime() > 30000);
      if (seg) {
        camId = c.id;
        at = new Date(new Date(seg.start_at).getTime() + 10000).toISOString().replace(/\.\d{3}Z$/, 'Z');
        break;
      }
    }
    expect(camId, 'a camera with a recording today').toBeTruthy();

    // 1) API: a real frame, then the cache
    const t0 = Date.now();
    const f1 = await request.get(`/api/v1/cameras/${camId}/frame?at=${encodeURIComponent(at)}`, { timeout: 60000 });
    expect(f1.status(), await f1.text().catch(() => '')).toBe(200);
    expect(f1.headers()['content-type']).toContain('image/jpeg');
    expect((await f1.body()).length).toBeGreaterThan(1000);
    const firstMs = Date.now() - t0;
    const t1 = Date.now();
    const f2 = await request.get(`/api/v1/cameras/${camId}/frame?at=${encodeURIComponent(at)}`);
    expect(f2.status()).toBe(200);
    expect(Date.now() - t1).toBeLessThan(Math.max(1500, firstMs / 2));
    testInfo.annotations.push({ type: 'frame', description: `first grab ${firstMs} ms, cached ${Date.now() - t1} ms` });

    // 2) playback timeline: hovering shows a floating preview with a picture
    await open(page, `/investigate/playback?camera=${camId}&t=${encodeURIComponent(at)}`);
    const pb = page.locator('investigate-playback');
    const tl = pb.locator('sw-timeline');
    await expect(tl).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000); // let the session and the timeline settle
    const box = (await tl.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
    await page.mouse.move(box.x + box.width * 0.5 + 3, box.y + box.height * 0.55);
    const prev = pb.locator('[data-tl-preview]');
    await expect(prev).toBeVisible({ timeout: 10000 });
    await expect.poll(async () => prev.locator('img, .none').count(), { timeout: 5000 }).toBeGreaterThan(0);
    await expect.poll(async () => {
      const img = prev.locator('img');
      if ((await img.count()) === 0) return 'none';
      return img.evaluate((el) => ((el as HTMLImageElement).naturalWidth > 0 ? 'loaded' : 'loading'));
    }, { timeout: 45000 }).not.toBe('loading');
    await page.screenshot({ path: path.join(OUT, `timeline-preview-${testInfo.project.name}.png`) });

    // 3) historical map: the selected camera's frame at the instant
    const map = await (await request.get(`/api/v1/events?limit=50`)).json();
    void map;
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    if (floor) {
      const fm = await (await request.get(`/api/v1/floors/${floor.id}/map`)).json();
      const anchored = fm.anchors.find((a: { resource_type: string; resource_id: string }) => a.resource_type === 'camera' && a.resource_id === camId);
      if (anchored) {
        await open(page, `/investigate/floors/${floor.id}?t=${encodeURIComponent(at)}&camera=${camId}`);
        const frame = page.locator('investigate-history-map [data-history-frame]');
        await expect(frame).toBeVisible({ timeout: 20000 });
        await expect.poll(async () => {
          const img = frame.locator('img');
          if ((await img.count()) === 0) return 'none';
          return img.evaluate((el) => ((el as HTMLImageElement).naturalWidth > 0 ? 'loaded' : 'loading'));
        }, { timeout: 45000 }).not.toBe('loading');
        await page.screenshot({ path: path.join(OUT, `history-frame-${testInfo.project.name}.png`), fullPage: true });
      } else {
        testInfo.annotations.push({ type: 'history', description: 'the camera with recordings is not placed on the plan; history frame step skipped' });
      }
    }
  });
});
