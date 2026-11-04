import { test, expect, type Page } from '@playwright/test';
import { FAKE_MEDIA, type RtcMode } from './live-fake-media';

// VIDEO-TRANSPORT-2400 (owner decisions 2026-11-04, lab audit 2026-11-04): the transport is exactly what the viewer's choice says, on
// every channel and surface; the personal choice (server-side, /me/prefs `video.transport`) wins over the installation's; a retry
// starts from the step that played last; a frozen live MSE stream is reconnected (MSE only: on MSE; `auto`: WebRTC after repeated
// freezes). No backend: the built app (the preview serves dist/), the API answered by page.route - including GET /media/video-policy,
// the server's one decision - and the browser media stack a fake (tests/live-fake-media.ts: a live socket that records what the player
// asked for, a scripted RTCPeerConnection). The fake MSE path never decodes a fragment, so the frozen-MSE tests start the watch on a
// player whose MSE socket is open (the player's own `onPlaying`), with a playhead that does not move - exactly a frozen stream.
// What it does not prove: real go2rtc media, a real phone, the lab (the owner's test plan in docs/changes/VIDEO-TRANSPORT-2400.md).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-video-transport-2400.spec.ts --project=desktop

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
type Choice = 'webrtc' | 'auto' | 'mse';

interface Setup {
  channel: 'local' | 'remote';
  installation: Choice;
  personal?: Choice | null;
  mseFallback?: boolean;
  rtc: Record<string, RtcMode>;
  /** the pre-2.40.0 per-browser key, to prove it is never followed */
  legacy?: Choice;
}

const ENCODING = { main: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 }, sub: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 } };

async function setup(page: Page, o: Setup) {
  const seen = { prefPuts: [] as unknown[] };
  await page.addInitScript(
    (x) => {
      const w = window as unknown as Record<string, unknown>;
      w.__rtc = x.rtc;
      localStorage.setItem('sw.wall.count', '4');
      localStorage.removeItem('sw.wall.quality');
      localStorage.removeItem('sw.live.works');
      if (x.legacy) localStorage.setItem('sw.transport', x.legacy);
      else localStorage.removeItem('sw.transport');
    },
    { rtc: o.rtc, legacy: o.legacy ?? '' },
  );
  await page.addInitScript(FAKE_MEDIA);
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live'];
      return json({
        user: { id: 'u', username: 'owner', display_name: 'Owner', source: o.channel === 'remote' ? 'remote' : 'ingress' },
        channel: o.channel,
        remote: o.channel === 'remote' ? { 'remote.policy': 'flag', 'remote.session': 'rolling_90d', 'remote.idle_lock_minutes': 720, 'remote.default_profile': 'main', 'remote.mse_fallback': o.mseFallback === false ? 'false' : 'true' } : null,
        bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'media/video-policy') {
      const choice = o.personal ?? o.installation;
      const order = choice !== 'auto' ? [choice] : o.channel === 'remote' && o.mseFallback === false ? ['webrtc'] : ['webrtc', 'mse'];
      return json({ choice, source: o.personal ? 'personal' : 'installation', explicit: choice !== 'auto', installation: o.installation, personal: o.personal ?? null, channel: o.channel, order, remote: o.channel === 'remote' ? { default_profile: 'main', mse_fallback: o.mseFallback !== false } : null });
    }
    if (p === 'me/prefs' && route.request().method() === 'PUT') {
      seen.prefPuts.push(route.request().postDataJSON());
      return json({ prefs: {}, stored: [], updated_at: null });
    }
    if (p === 'cameras') {
      const cam = { id: 'c2', recorder_id: 'r', channel: 2, name: 'Street', name_source: 'nvr', alias: null, enabled: true, sort_order: 0, grid_col_span: 1, main_track: 1, sub_track: 2, status: 'online', last_seen_at: null, can_view_live: true, encoding: ENCODING };
      return json({ cameras: [cam], recorder: null, can_sync: false, media: {} });
    }
    if (p === 'settings') {
      return json({ settings: { 'media.transport_default': o.installation, 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'media.video_notices': 'false', 'snapshots.max_age_s': 60, 'remote.max_live_streams': 16, 'remote.wall_profile': 'sub', 'ui.kiosk_cols': 2, 'ui.kiosk_rows': 2 }, can_edit: false });
    }
    if (p === 'devices/camera-card/resolve') return json({ state: 'live', kind: 'nvr', camera_id: 'c2', recorder_id: 'r', channel: 2, name: 'Street', status: 'online', encoding: ENCODING });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-11-04T00:00:00Z', version: 'test' });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
  return seen;
}

const sockets = (page: Page) =>
  page.evaluate(() => (window as unknown as { __liveSockets: { profile: string; kind: string }[] }).__liveSockets.map(({ profile, kind }) => `${profile}:${kind}`));
const kinds = async (page: Page) => [...new Set((await sockets(page)).map((s) => s.split(':')[1]).filter(Boolean))].sort();

async function walked(page: Page, n: number) {
  await expect.poll(async () => (await sockets(page)).filter((s) => !s.endsWith(':')).length, { timeout: 25000 }).toBeGreaterThanOrEqual(n);
  await page.waitForTimeout(1500);
}

const cameraPage = async (page: Page) => {
  await page.goto('/?design=a#/live/cameras/c2');
  await page.waitForSelector('sw-app');
  await expect(page.locator('live-camera sw-live-player')).toHaveCount(1, { timeout: 15000 });
};
const wallPage = async (page: Page) => {
  await page.goto('/?design=a#/live/wall');
  await page.waitForSelector('live-wall');
  await expect(page.locator('live-wall sw-camera-tile[data-cam="c2"] sw-live-player')).toHaveCount(1, { timeout: 15000 });
};
const kioskPage = async (page: Page) => {
  await page.goto('/?design=a#/kiosk/all');
  await page.waitForSelector('kiosk-wall');
  await expect(page.locator('kiosk-wall sw-camera-tile sw-live-player')).toHaveCount(1, { timeout: 15000 });
};

test.describe('the transport is exactly the choice (VIDEO-TRANSPORT-2400)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'layout-independent player logic');
  });

  test('remote channel, installation MSE only: the camera page, the wall and the kiosk open MSE only (lab audit finding 1)', async ({ page }) => {
    await setup(page, { channel: 'remote', installation: 'mse', mseFallback: true, rtc: { main: 'ok', sub: 'ok' } });
    await cameraPage(page);
    await walked(page, 1);
    expect(await kinds(page), `camera page: ${(await sockets(page)).join(', ')}`).toEqual(['mse']);
    expect((await sockets(page))[0]).toBe('main:mse');
    await wallPage(page);
    await walked(page, 1);
    await kioskPage(page);
    await walked(page, 1);
    expect(await kinds(page), `wall + kiosk: ${(await sockets(page)).join(', ')}`).toEqual(['mse']);
  });

  test('remote channel, MSE only, after a dropped stream the retry is MSE again (never "WebRTC first again")', async ({ page }) => {
    await setup(page, { channel: 'remote', installation: 'mse', rtc: { main: 'ok', sub: 'ok' } });
    await cameraPage(page);
    await walked(page, 1);
    await page.locator('live-camera sw-live-player').evaluate((el) => (el as unknown as { ws: { onclose: (e: CloseEvent) => void } }).ws.onclose(new CloseEvent('close', { code: 1006 })));
    await expect.poll(async () => (await sockets(page)).filter((s) => !s.endsWith(':')).length, { timeout: 15000 }).toBeGreaterThanOrEqual(2);
    expect(await kinds(page)).toEqual(['mse']);
  });

  test('the personal choice wins: remote, installation automatic, personal MSE only', async ({ page }) => {
    await setup(page, { channel: 'remote', installation: 'auto', personal: 'mse', rtc: { main: 'ok', sub: 'ok' } });
    await cameraPage(page);
    await walked(page, 1);
    expect(await kinds(page)).toEqual(['mse']);
    await expect(page.locator('live-camera [data-transport-choice]')).toHaveAttribute('data-transport-choice', 'mse');
    await expect(page.locator('live-camera [data-transport-own]')).toBeVisible();
  });

  test('the personal choice wins on the LAN too: installation MSE, personal WebRTC - the wall opens WebRTC only', async ({ page }) => {
    await setup(page, { channel: 'local', installation: 'mse', personal: 'webrtc', rtc: { main: 'fail', sub: 'fail' } });
    await wallPage(page);
    await walked(page, 1);
    expect(await kinds(page)).toEqual(['webrtc']);
  });

  test('the old per-browser key is never followed; it seeds an empty server choice once and is removed', async ({ page }) => {
    const seen = await setup(page, { channel: 'local', installation: 'mse', legacy: 'webrtc', rtc: { main: 'ok', sub: 'ok' } });
    await cameraPage(page);
    await walked(page, 1);
    expect(await kinds(page), 'the installation choice (the mock does not apply the seed)').toEqual(['mse']);
    expect(seen.prefPuts).toEqual([{ 'video.transport': 'webrtc' }]);
    expect(await page.evaluate(() => localStorage.getItem('sw.transport'))).toBeNull();
  });

  test('picking a transport on the camera page saves the personal choice on the server', async ({ page }) => {
    const seen = await setup(page, { channel: 'local', installation: 'auto', rtc: { main: 'ok', sub: 'ok' } });
    await cameraPage(page);
    await page.locator('live-camera .transport button', { hasText: 'MSE' }).click();
    await expect.poll(() => seen.prefPuts).toEqual([{ 'video.transport': 'mse' }]);
    expect(await page.evaluate(() => localStorage.getItem('sw.transport'))).toBeNull();
  });

  test('a retry starts from the step that played last: remote automatic without the MSE fallback, main fails, sub plays', async ({ page }) => {
    await setup(page, { channel: 'remote', installation: 'auto', mseFallback: false, rtc: { main: 'fail', sub: 'ok' } });
    await cameraPage(page);
    const player = page.locator('live-camera sw-live-player');
    await expect.poll(() => player.evaluate((p) => (p as unknown as { status: string }).status), { timeout: 25000 }).toBe('playing');
    expect(await sockets(page)).toEqual(['main:webrtc', 'sub:webrtc']);
    await player.evaluate((el) => (el as unknown as { ws: { onclose: (e: CloseEvent) => void } }).ws.onclose(new CloseEvent('close', { code: 1006 })));
    await expect.poll(async () => (await sockets(page)).length, { timeout: 15000 }).toBeGreaterThanOrEqual(3);
    expect((await sockets(page))[2], 'not main:webrtc (the top of the plan) again').toBe('sub:webrtc');
  });
});

test.describe('frozen live MSE (VIDEO-TRANSPORT-2400, lab audit finding 5)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'layout-independent player logic');
    testInfo.setTimeout(120_000);
  });

  /** The player's own "first frame" entry on its open MSE socket - its playhead then never moves (a frozen stream). */
  const fakePlaying = (page: Page) => page.locator('live-camera sw-live-player').evaluate((el) => (el as unknown as { onPlaying: () => void }).onPlaying());

  test('MSE only: a frozen stream is reconnected on MSE (never WebRTC)', async ({ page }) => {
    await setup(page, { channel: 'local', installation: 'mse', rtc: { main: 'ok', sub: 'ok' } });
    await cameraPage(page);
    await walked(page, 1);
    for (let round = 1; round <= 2; round++) {
      const before = (await sockets(page)).length;
      await fakePlaying(page);
      await expect(page.locator('live-camera sw-live-player [data-player-error]')).toContainText('הווידאו נעצר', { timeout: 15000 });
      await expect.poll(async () => (await sockets(page)).filter((s) => !s.endsWith(':')).length, { timeout: 15000 }).toBeGreaterThan(before);
    }
    expect(await kinds(page)).toEqual(['mse']);
  });

  test('automatic: after repeated freezes the stream moves on to WebRTC', async ({ page }) => {
    await setup(page, { channel: 'local', installation: 'auto', rtc: { main: 'hang', sub: 'hang' } });
    await cameraPage(page);
    // WebRTC never connects (the connect bound) -> MSE
    await expect.poll(() => kinds(page), { timeout: 20000 }).toContain('mse');
    for (let round = 1; round <= 2; round++) {
      await expect.poll(async () => (await sockets(page)).at(-1), { timeout: 20000 }).toMatch(/:mse$/);
      const before = (await sockets(page)).length;
      await fakePlaying(page);
      await expect.poll(async () => (await sockets(page)).filter((s) => !s.endsWith(':')).length, { timeout: 20000 }).toBeGreaterThan(before);
    }
    await expect.poll(async () => (await sockets(page)).at(-1), { timeout: 5000 }).toMatch(/:webrtc$/);
  });
});
