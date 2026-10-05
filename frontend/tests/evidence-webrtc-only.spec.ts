import { test, expect, type Page } from '@playwright/test';
import { FAKE_MEDIA, type RtcMode } from './live-fake-media';

// Owner bug 2026-10-01: "I set the stream setting to WebRTC only (הגדרות › וידאו ומדיה = media.transport_default webrtc)
// and still get an MSE stream in the cameras screen." The owner reaches the system both on the LAN and through the remote
// route (/arx, `me.channel === 'remote'`), so every surface that plays a live camera is checked on both channels:
//   - the single camera page, the all-cameras wall, the kiosk wall and the device camera card (its tile and its enlarged
//     view);
//   - a remembered per-camera step (`sw.live.works`, 0.1.148) left over from an earlier transport choice;
//   - the installation settings cached by the running page (productSettings) after the choice changed elsewhere;
//   - the personal per-browser override (`sw.transport`) set to WebRTC.
// An explicit WebRTC choice must never open an MSE stream on any channel; `auto` / `mse` keep their behaviour (the control
// test). No backend: the built app (npx vite build; the preview serves dist/, SW_BASE_URL for another port), the API
// answered by page.route, and the browser media stack a fake (tests/live-fake-media.ts): a live socket that records
// what the player asked for (`webrtc/offer` or `mse`) and an RTCPeerConnection whose outcome per profile is set by the test.
// What it does not prove: real go2rtc media, or which surface the owner looked at (the lab / owner check).

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

type Transport = 'webrtc' | 'auto' | 'mse';


interface Setup {
  channel: 'local' | 'remote';
  /** the installation default (media.transport_default); a function: read on every GET /settings (the stale-cache test) */
  transport: Transport | (() => Transport);
  mseFallback?: boolean;
  rtc: Record<string, RtcMode>;
  /** the personal per-browser override (`sw.transport`) */
  override?: Transport;
  /** `sw.live.works` (0.1.148 per-camera memory) */
  works?: Record<string, { step: string; at: number }>;
  /** media.video_notices (owner 2026-10-01): the notes about how the stream plays; off by default */
  notices?: boolean;
}

const ENCODING = { main: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 }, sub: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 } };

async function setup(page: Page, o: Setup) {
  await page.addInitScript(
    (x) => {
      const w = window as unknown as Record<string, unknown>;
      w.__rtc = x.rtc;
      localStorage.setItem('sw.wall.count', '4');
      localStorage.removeItem('sw.wall.quality');
      if (x.override) localStorage.setItem('sw.transport', x.override);
      else localStorage.removeItem('sw.transport');
      if (x.works) localStorage.setItem('sw.live.works', JSON.stringify(x.works));
      else localStorage.removeItem('sw.live.works');
    },
    { rtc: o.rtc, override: o.override ?? '', works: o.works ?? null },
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
    if (p === 'cameras') {
      const cam = { id: 'c2', recorder_id: 'r', channel: 2, name: 'Street', name_source: 'nvr', alias: null, enabled: true, sort_order: 0, grid_col_span: 1, main_track: 1, sub_track: 2, status: 'online', last_seen_at: null, can_view_live: true, encoding: ENCODING };
      return json({ cameras: [cam], recorder: null, can_sync: false, media: {} });
    }
    if (p === 'settings') {
      const t = typeof o.transport === 'function' ? o.transport() : o.transport;
      return json({ settings: { 'media.transport_default': t, 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'media.video_notices': o.notices ? 'true' : 'false', 'snapshots.max_age_s': 60, 'remote.max_live_streams': 16, 'remote.wall_profile': 'sub', 'ui.kiosk_cols': 2, 'ui.kiosk_rows': 2 }, can_edit: false });
    }
    if (p === 'devices/camera-card/resolve') return json({ state: 'live', kind: 'nvr', camera_id: 'c2', recorder_id: 'r', channel: 2, name: 'Street', status: 'online', encoding: ENCODING });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

const sockets = (page: Page) =>
  page.evaluate(() => (window as unknown as { __liveSockets: { profile: string; camera: string; kind: string }[] }).__liveSockets.map(({ profile, kind }) => `${profile}:${kind}`));
const kinds = async (page: Page) => [...new Set((await sockets(page)).map((s) => s.split(':')[1]).filter(Boolean))].sort();

/** Waits until the player walked `n` negotiated steps (or more), then a little longer for any step that would follow. */
async function walked(page: Page, n: number) {
  await expect.poll(async () => (await sockets(page)).filter((s) => !s.endsWith(':')).length, { timeout: 20000 }).toBeGreaterThanOrEqual(n);
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
/** The device camera card (area screens) on its own, mounted into the running app, then its enlarged view. */
const cameraCard = async (page: Page) => {
  await page.goto('/?design=a#/live/cameras/none');
  await page.waitForSelector('sw-app');
  await page.evaluate(async () => {
    await customElements.whenDefined('devices-camera-card');
    const card = document.createElement('devices-camera-card') as HTMLElement & { source: unknown };
    card.source = { kind: 'nvr', recorder_id: 'r', channel: 2 };
    card.style.cssText = 'display:block;inline-size:480px;block-size:270px';
    // its own scroller: the card's visibility observer takes the nearest scrolling ancestor as its root
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:480px;block-size:270px;overflow-y:auto;z-index:5000';
    box.append(card);
    document.body.append(box);
  });
};

test.describe('an explicit WebRTC choice never opens an MSE stream (owner bug 2026-10-01)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'layout-independent player logic');
  });

  test('remote channel, camera page, installation WebRTC, remote.mse_fallback on: WebRTC only (the other profile over WebRTC)', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'webrtc', mseFallback: true, rtc: { main: 'fail', sub: 'fail' }, notices: true });
    await cameraPage(page);
    await walked(page, 2);
    expect(await kinds(page), `steps: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
    expect((await sockets(page)).slice(0, 2)).toEqual(['main:webrtc', 'sub:webrtc']);
    await expect(page.locator('live-camera [data-remote-video-policy]')).toContainText('בלי MSE');
  });

  test('remote channel, camera page, installation WebRTC, main does not decode: sub over WebRTC plays, never MSE', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'webrtc', mseFallback: true, rtc: { main: 'nodecode', sub: 'ok' } });
    await cameraPage(page);
    const player = page.locator('live-camera sw-live-player');
    await expect.poll(() => player.evaluate((p) => (p as unknown as { status: string }).status), { timeout: 25000 }).toBe('playing');
    expect(await player.evaluate((p) => (p as unknown as { transport: string }).transport)).toBe('webrtc');
    expect(await sockets(page)).toEqual(['main:webrtc', 'sub:webrtc']);
  });

  test('remote channel, camera page, installation WebRTC, remote.mse_fallback off: WebRTC only', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'webrtc', mseFallback: false, rtc: { main: 'fail', sub: 'fail' } });
    await cameraPage(page);
    await walked(page, 2);
    expect(await kinds(page)).toEqual(['webrtc']);
  });

  test('remote channel, the all-cameras wall, installation WebRTC: WebRTC only', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'webrtc', mseFallback: true, rtc: { main: 'fail', sub: 'fail' } });
    await wallPage(page);
    await walked(page, 2);
    expect(await kinds(page), `steps: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
  });

  test('remote channel, the kiosk wall, installation WebRTC: WebRTC only', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'webrtc', mseFallback: true, rtc: { main: 'fail', sub: 'fail' } });
    await kioskPage(page);
    await walked(page, 2);
    expect(await kinds(page), `steps: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
  });

  test('remote channel, the device camera card and its enlarged view, installation WebRTC: WebRTC only', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'webrtc', mseFallback: true, rtc: { main: 'fail', sub: 'fail' } });
    await cameraCard(page);
    await walked(page, 2);
    expect(await kinds(page), `card: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
    await page.locator('devices-camera-card [data-camera-expand]').click();
    await expect(page.locator('[data-camera-big]')).toHaveCount(1);
    const before = (await sockets(page)).length;
    await expect.poll(async () => (await sockets(page)).length - before, { timeout: 20000 }).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(1500);
    expect(await kinds(page), `enlarged: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
  });

  test('remote channel, the personal override WebRTC (installation MSE): WebRTC only', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'mse', override: 'webrtc', mseFallback: true, rtc: { main: 'fail', sub: 'fail' } });
    await cameraPage(page);
    await walked(page, 2);
    expect(await kinds(page)).toEqual(['webrtc']);
  });

  test('control: remote channel with the installation on auto keeps the announced MSE last resort', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'auto', mseFallback: true, rtc: { main: 'fail', sub: 'fail' }, notices: true });
    await cameraPage(page);
    await expect.poll(() => kinds(page), { timeout: 20000 }).toContain('mse');
    expect((await sockets(page)).slice(0, 2)).toEqual(['main:webrtc', 'main:mse']);
    await expect(page.locator('live-camera [data-remote-video-policy]')).toContainText('MSE רק כמוצא אחרון');
  });

  test('the notes about how the stream plays are hidden by default; the badge stays and explains itself in its tooltip (owner 2026-10-01)', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'auto', mseFallback: true, rtc: { main: 'fail', sub: 'fail' } });
    await cameraPage(page);
    await expect.poll(() => kinds(page), { timeout: 20000 }).toContain('mse');
    const live = page.locator('live-camera');
    await expect(live.locator('sw-live-player [data-video-badge]')).toBeVisible({ timeout: 20000 });
    await expect(live.locator('sw-live-player [data-video-badge]')).toHaveAttribute('title', /MSE דרך המנהרה/);
    await expect(live.locator('[data-video-notice]')).toHaveCount(0);
    await expect(live.locator('[data-remote-video-policy]')).toHaveCount(0);
    await expect(live).not.toContainText('מנגן דרך');
  });

  test('with media.video_notices on the banner, the remote-policy hint and the "plays through" line show', async ({ page }) => {
    await setup(page, { channel: 'remote', transport: 'auto', mseFallback: true, rtc: { main: 'fail', sub: 'fail' }, notices: true });
    await cameraPage(page);
    await expect.poll(() => kinds(page), { timeout: 20000 }).toContain('mse');
    const live = page.locator('live-camera');
    await expect(live.locator('[data-video-notice]')).toContainText('MSE דרך המנהרה', { timeout: 20000 });
    await expect(live.locator('[data-remote-video-policy]')).toContainText('MSE רק כמוצא אחרון');
  });

  test('LAN, the wall, installation WebRTC with remembered MSE steps from earlier choices: never replayed', async ({ page }) => {
    const at = Date.now();
    await setup(page, {
      channel: 'local',
      transport: 'webrtc',
      rtc: { main: 'nodecode', sub: 'nodecode' },
      // what an earlier `auto` / `mse` session remembered, and a (hand-made) MSE step under the webrtc key itself
      works: { 'c2|sub|auto': { step: 'sub:mse', at }, 'c2|sub|mse': { step: 'main:mse', at }, 'c2|sub|webrtc': { step: 'sub:mse', at } },
    });
    await wallPage(page);
    await walked(page, 2);
    expect(await kinds(page), `steps: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
    expect((await sockets(page)).slice(0, 2)).toEqual(['sub:webrtc', 'main:webrtc']);
  });

  test('LAN, the camera page and the kiosk, installation WebRTC: WebRTC only', async ({ page }) => {
    await setup(page, { channel: 'local', transport: 'webrtc', rtc: { main: 'fail', sub: 'fail' } });
    await cameraPage(page);
    await walked(page, 1);
    await kioskPage(page);
    await walked(page, 2);
    expect(await kinds(page), `steps: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
  });

  test('a page left open while the installation switched MSE -> WebRTC elsewhere follows the new choice (no stale settings)', async ({ page }) => {
    let transport: Transport = 'mse';
    await setup(page, { channel: 'local', transport: () => transport, rtc: { main: 'ok', sub: 'ok' } });
    await wallPage(page);
    await expect.poll(() => kinds(page), { timeout: 15000 }).toEqual(['mse']);
    // the owner changes הגדרות › וידאו ומדיה on another device; this page stays open, a few minutes pass, he opens the wall again
    transport = 'webrtc';
    await page.evaluate(() => {
      const real = Date.now.bind(Date);
      Date.now = () => real() + 5 * 60 * 1000;
      (window as unknown as { __liveSockets: unknown[] }).__liveSockets.length = 0;
    });
    await page.evaluate(() => (location.hash = '#/live/cameras/none'));
    await expect(page.locator('live-wall')).toHaveCount(0);
    await page.evaluate(() => (location.hash = '#/live/wall'));
    await expect(page.locator('live-wall sw-camera-tile[data-cam="c2"] sw-live-player')).toHaveCount(1, { timeout: 15000 });
    await walked(page, 1);
    expect(await kinds(page), `steps: ${(await sockets(page)).join(', ')}`).toEqual(['webrtc']);
  });
});
