import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Owner report 2026-10-02 (phone): the playback toolbar (speeds, 10 s skips, pause, full screen) was a large dark panel drawn OVER the
// recording and covered more than half of the picture. The controls are ONE bar under the video on every width; the time stamp stays on
// the picture's corner. Mocked backend (page.route on api/v1); needs the Vite dev server or a fresh build.
//   SW_BASE_URL=http://127.0.0.1:5190/ npx playwright test tests/evidence-playback-controls-below.spec.ts
//   SW_SHOTS=<dir> also saves screenshots.
const PERMS = ['video.live', 'video.playback', 'events.read', 'map.read'];
const SHOTS = process.env.SW_SHOTS ?? '';

async function mock(page: Page) {
  const now = new Date();
  const from = new Date(now.getTime() - 20 * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const to = new Date(now.getTime() - 5 * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u1', username: 'u1', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'תפקיד', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.design': 'a', 'time.zone': 'Asia/Jerusalem' }, can_edit: false });
    if (p === 'cameras') return json({ cameras: [{ id: 'c1', recorder_id: 'r', channel: 1, name: 'כניסה', name_source: 'nvr', alias: null, enabled: true, sort_order: 0, grid_col_span: 1, main_track: 101, sub_track: 102, status: 'online', last_seen_at: null, can_view_live: true }], recorder: null, can_sync: false });
    if (p.startsWith('cameras/c1/recordings')) return json({ camera_id: 'c1', from, to, track_id: 101, segments: [{ start_at: from, end_at: to, kind: 'continuous', track_id: 101, start_raw: '', end_raw: '' }], coverage: 'complete', matches: 1, pages: 1, searched_at: from, timezone: 'Asia/Jerusalem', note: '' });
    if (p.includes('events')) return json({ events: [] });
    if (p.startsWith('cases/bookmarks')) return json({ bookmarks: [] });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

for (const [name, w, h] of [['390', 390, 844], ['1440', 1440, 900]] as const) {
  test.describe(`playback controls, ${name}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('the controls bar sits under the video, never over the picture', async ({ page }, info) => {
      test.skip(info.project.name !== (w === 390 ? 'mobile' : 'desktop'), 'one project per width');
      await mock(page);
      await page.goto('about:blank');
      await page.goto('/?design=a#/investigate/playback');
      await page.waitForSelector('investigate-playback .stage .bar');
      await page.waitForTimeout(1200);
      const box = async (sel: string) => (await page.locator(`investigate-playback ${sel}`).first().boundingBox())!;
      const video = await box('.stage > .video, .stage > .grid');
      const bar = await box('.stage .bar .inner');
      expect(bar.y, 'the bar starts below the picture').toBeGreaterThanOrEqual(video.y + video.height - 1);
      expect(bar.x).toBeGreaterThanOrEqual(-1);
      expect(bar.x + bar.width).toBeLessThanOrEqual(w + 1);
      // 44 px touch targets in the bar
      for (const b of await page.locator('investigate-playback .stage .bar sw-button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43);
      // the page is not pushed sideways
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `playback-controls-${name}.png`) });
      }
    });
  });
}
