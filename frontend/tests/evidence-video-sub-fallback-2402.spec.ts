import { test, expect, type Page } from '@playwright/test';
import { FAKE_MEDIA, type RtcMode } from './live-fake-media';

// VIDEO-SUB-FALLBACK-2402 (owner round 20, Q3 = a; the lab's cameras 8 and 10: the NVR accepts the sub-stream request and sends nothing):
// on the all-cameras wall with the AUTOMATIC quality, a sub stream that gives no media / never connects moves the tile to the main
// stream on the SAME transport and the tile says "עבר לזרם הראשי"; an explicit quality never switches (the tile says the stream does
// not arrive); the fallback is remembered for the tab, so a reload opens main directly. No backend: the built app, the API answered by
// page.route, the media stack a fake (tests/live-fake-media.ts: its MSE socket never sends a fragment - a sub stream with no media; its
// RTCPeerConnection per profile: `hang` = never connects, `ok` = plays).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-video-sub-fallback-2402.spec.ts --project=desktop

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const ENCODING = { main: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 }, sub: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 } };

interface Setup {
  channel: 'local' | 'remote';
  transport: 'auto' | 'webrtc' | 'mse';
  rtc: Record<string, RtcMode>;
  /** the wall's quality on this device: '' = automatic (the installation's default) */
  quality?: '' | 'sub' | 'main';
}

async function setup(page: Page, o: Setup) {
  await page.addInitScript(
    (x) => {
      const w = window as unknown as Record<string, unknown>;
      w.__rtc = x.rtc;
      localStorage.setItem('sw.wall.count', '4');
      if (x.quality) localStorage.setItem('sw.wall.quality', x.quality);
      else localStorage.removeItem('sw.wall.quality');
      localStorage.removeItem('sw.live.works');
    },
    { rtc: o.rtc, quality: o.quality ?? '' },
  );
  await page.addInitScript(FAKE_MEDIA);
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live'];
      return json({
        user: { id: 'u', username: 'owner', display_name: 'Owner', source: o.channel === 'remote' ? 'remote' : 'ingress' },
        channel: o.channel,
        remote: o.channel === 'remote' ? { 'remote.policy': 'flag', 'remote.session': 'rolling_90d', 'remote.idle_lock_minutes': 720, 'remote.default_profile': 'main', 'remote.mse_fallback': 'true' } : null,
        bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'media/video-policy') {
      const order = o.transport === 'auto' ? ['webrtc', 'mse'] : [o.transport];
      return json({ choice: o.transport, source: 'installation', explicit: o.transport !== 'auto', installation: o.transport, personal: null, channel: o.channel, order, remote: o.channel === 'remote' ? { default_profile: 'main', mse_fallback: true } : null });
    }
    if (p === 'cameras') {
      const cam = { id: 'c8', recorder_id: 'r', channel: 8, name: 'Pano', name_source: 'nvr', alias: null, enabled: true, sort_order: 0, grid_col_span: 1, main_track: 1, sub_track: 2, status: 'online', last_seen_at: null, can_view_live: true, encoding: ENCODING };
      return json({ cameras: [cam], recorder: null, can_sync: false, media: {} });
    }
    if (p === 'settings') {
      return json({ settings: { 'media.transport_default': o.transport, 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'media.video_notices': 'false', 'snapshots.max_age_s': 60, 'remote.max_live_streams': 16, 'remote.wall_profile': 'sub', 'remote.mse_fallback': 'true' }, can_edit: false });
    }
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-11-04T00:00:00Z', version: 'test' });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

const sockets = (page: Page) =>
  page.evaluate(() => (window as unknown as { __liveSockets: { profile: string; kind: string }[] }).__liveSockets.filter((s) => s.kind).map(({ profile, kind }) => `${profile}:${kind}`));
const tile = (page: Page) => page.locator('live-wall sw-camera-tile[data-cam="c8"]');
const player = (page: Page) => tile(page).locator('sw-live-player');

async function wall(page: Page) {
  await page.goto('/?design=a#/live/wall');
  await page.waitForSelector('live-wall');
  await expect(player(page)).toHaveCount(1, { timeout: 15000 });
}

test.describe('sub stream gives nothing (VIDEO-SUB-FALLBACK-2402)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'layout-independent player logic');
    testInfo.setTimeout(90_000);
  });

  test('automatic quality, MSE only: the sub stream sends no media, the tile moves to main over MSE and says so', async ({ page }) => {
    await setup(page, { channel: 'local', transport: 'mse', rtc: {} });
    await wall(page);
    await expect.poll(() => sockets(page), { timeout: 40000 }).toEqual(['sub:mse', 'main:mse']);
    await expect(player(page).locator('[data-sub-fallback]')).toHaveText('עבר לזרם הראשי', { timeout: 5000 });
    await expect(player(page).locator('[data-sub-fallback]')).toHaveAttribute('data-sub-fallback', 'sub_no_media');
    // remembered for the tab: a reload opens main directly (no sub attempt)
    await page.reload();
    await page.waitForSelector('live-wall');
    await expect.poll(() => sockets(page), { timeout: 15000 }).toEqual(['main:mse']);
    await expect(player(page).locator('[data-sub-fallback]')).toHaveAttribute('data-sub-fallback', 'sub_remembered');
  });

  test('automatic quality, WebRTC only: the sub stream never connects, the tile plays main over WebRTC (never MSE)', async ({ page }) => {
    await setup(page, { channel: 'local', transport: 'webrtc', rtc: { sub: 'hang', main: 'ok' } });
    await wall(page);
    await expect.poll(() => player(page).evaluate((p) => (p as unknown as { status: string }).status), { timeout: 40000 }).toBe('playing');
    expect(await sockets(page)).toEqual(['sub:webrtc', 'main:webrtc']);
    await expect(player(page).locator('[data-sub-fallback]')).toBeVisible();
  });

  test('remote channel, automatic quality, MSE only: the same move inside the remote plan, MSE only', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'mse', rtc: {} });
    await wall(page);
    await expect.poll(() => sockets(page), { timeout: 40000 }).toEqual(['sub:mse', 'main:mse']);
    await expect(player(page).locator('[data-sub-fallback]')).toBeVisible();
  });

  test('an explicit quality (sub) never switches: the tile says the sub stream does not arrive', async ({ page }) => {
    await setup(page, { channel: 'local', transport: 'mse', rtc: {}, quality: 'sub' });
    await wall(page);
    await expect(player(page).locator('[data-player-error]')).toHaveText('הזרם המשני לא מגיע מהמצלמה', { timeout: 40000 });
    expect((await sockets(page)).every((s) => s === 'sub:mse'), (await sockets(page)).join(', ')).toBe(true);
    await expect(player(page).locator('[data-sub-fallback]')).toHaveCount(0);
  });
});
