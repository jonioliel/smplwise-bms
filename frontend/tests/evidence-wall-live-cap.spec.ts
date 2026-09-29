import { test, expect, type Page } from '@playwright/test';

// Hotfix: the camera wall against the remote live cap (`remote.max_live_streams`), the wall quality choice and the
// visible-tiles-only streams. No backend: the page is the built app (npm run build; the preview server serves dist/),
// the API is answered by page.route (me / cameras / settings / snapshot) and the browser's media stack by an init script
// (a fake relay socket that applies the server's per-sign-in cap the way media.py does - accept, error message, close
// 4429 - and a fake RTCPeerConnection that connects and plays). What it does not prove: the real relay and go2rtc.

interface Sock {
  camera: string;
  profile: string;
  kind: string;
  closed: boolean;
  refused: boolean;
}

interface Opts {
  cams: number;
  channel: 'remote' | 'local';
  remoteCap: number; // remote.max_live_streams in the settings
  serverCap: number | null; // what the fake relay really allows (null = no refusal)
  silentCams: string[]; // cameras whose refusal arrives as a bare close 4429 (no message)
  admin: boolean;
  mediaCap: number;
  remoteWall: 'sub' | 'main';
  lanWall: 'sub' | 'main';
  main265: string[]; // cameras whose main stream cannot play over WebRTC
  mse: boolean;
}

const BASE: Opts = { cams: 8, channel: 'remote', remoteCap: 4, serverCap: null, silentCams: [], admin: false, mediaCap: 32, remoteWall: 'sub', lanWall: 'sub', main265: [], mse: true };

const FAKE_MEDIA = (o: Pick<Opts, 'serverCap' | 'silentCams'>) => {
  const w = window as unknown as Record<string, unknown>;
  const socks: Sock[] = [];
  w.__socks = socks;
  const RealWS = window.WebSocket;
  class FakeLive {
    url: string;
    readyState = 0;
    binaryType = 'blob';
    entry: Sock;
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(url: string) {
      this.url = url;
      const u = new URL(url);
      this.entry = { camera: (/\/media\/live\/([^/]+)\/ws/.exec(u.pathname) ?? [])[1] ?? '', profile: u.searchParams.get('profile') || 'sub', kind: '', closed: false, refused: false };
      w.__lastProfile = this.entry.profile;
      const active = socks.filter((s) => !s.closed && !s.refused).length;
      socks.push(this.entry);
      const refuse = o.serverCap != null && active >= o.serverCap;
      setTimeout(() => {
        if (this.entry.closed) return;
        this.readyState = 1;
        this.onopen?.(new Event('open'));
        if (!refuse) return;
        this.entry.refused = true;
        if (!o.silentCams.includes(this.entry.camera)) setTimeout(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'error', value: 'remote_live_cap', message: 'x', max: o.serverCap }) })), 10);
        setTimeout(() => {
          this.readyState = 3;
          this.onclose?.(Object.assign(new Event('close'), { code: 4429 }) as CloseEvent);
        }, 30);
      }, 20);
    }
    send(data: string) {
      const msg = JSON.parse(data) as { type: string };
      const reply = (body: unknown) => setTimeout(() => this.readyState === 1 && !this.entry.refused && this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(body) })), 20);
      if (msg.type === 'webrtc/offer') {
        this.entry.kind = 'webrtc';
        reply({ type: 'webrtc/answer', value: 'v=0 fake-answer' });
      } else if (msg.type === 'mse') {
        this.entry.kind = 'mse';
        reply({ type: 'mse', value: 'video/mp4; codecs="avc1.640029"' });
      }
    }
    close() {
      this.readyState = 3;
      this.entry.closed = true;
    }
  }
  const Patched = function (this: unknown, url: string | URL, protocols?: string | string[]) {
    const u = String(url);
    if (u.includes('/media/live/')) return new FakeLive(u);
    return new RealWS(u, protocols);
  } as unknown as typeof WebSocket;
  Object.assign(Patched, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3, prototype: RealWS.prototype });
  window.WebSocket = Patched;

  class FakePC {
    connectionState = 'new';
    ontrack: ((e: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null;
    onicecandidate: ((e: { candidate: null }) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    private timers: number[] = [];
    private bytes = 0;
    private frames = 0;
    addTransceiver() {}
    async createOffer() {
      return { type: 'offer', sdp: 'v=0 fake-offer' };
    }
    async setLocalDescription() {}
    async addIceCandidate() {}
    async getStats() {
      return new Map([['v', { type: 'inbound-rtp', kind: 'video', bytesReceived: this.bytes, framesDecoded: this.frames }]]);
    }
    private later(ms: number, fn: () => void) {
      this.timers.push(window.setTimeout(() => this.connectionState !== 'closed' && fn(), ms));
    }
    async setRemoteDescription() {
      this.later(60, () => {
        this.connectionState = 'connected';
        this.onconnectionstatechange?.();
      });
      this.later(80, () => {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 180;
        const ctx = c.getContext('2d')!;
        this.timers.push(
          window.setInterval(() => {
            ctx.fillStyle = '#16a34a';
            ctx.fillRect(0, 0, 320, 180);
            this.bytes += 4000;
            this.frames += 1;
          }, 100),
        );
        const stream = c.captureStream(10);
        this.ontrack?.({ streams: [stream], track: stream.getVideoTracks()[0] });
      });
    }
    close() {
      this.timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      this.connectionState = 'closed';
    }
  }
  (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = FakePC;
};

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

async function openWall(page: Page, over: Partial<Opts> = {}, hash = '#/live/wall') {
  const o: Opts = { ...BASE, ...over };
  const ids = Array.from({ length: o.cams }, (_, i) => `c${i + 1}`);
  await page.addInitScript(FAKE_MEDIA, { serverCap: o.serverCap, silentCams: o.silentCams });
  await page.addInitScript(() => localStorage.setItem('sw.wall.count', '32')); // the wall shows every camera (its default layout is 4 tiles)
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === 'me') {
      const perms = o.admin ? ['system.configure', 'video.live'] : ['video.live'];
      return json({
        user: { id: 'u', username: 'dana', display_name: 'Dana', source: o.channel === 'remote' ? 'remote' : 'ingress' },
        channel: o.channel,
        remote: o.channel === 'remote' ? { 'remote.default_profile': 'main', 'remote.mse_fallback': o.mse ? 'true' : 'false' } : null,
        bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (path === 'cameras') {
      const cameras = ids.map((id, i) => ({
        id, recorder_id: 'r', channel: i + 1, name: `מצלמה ${i + 1}`, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 1, sub_track: 2,
        status: 'online', last_seen_at: null, can_view_live: true,
        encoding: { main: { codec: o.main265.includes(id) ? 'H.265' : 'H.264', webrtc: o.main265.includes(id) ? 'no' : 'ok' }, sub: { codec: 'H.264', webrtc: 'ok' } },
      }));
      return json({ cameras, recorder: null, can_sync: false, media: {} });
    }
    if (path === 'settings') {
      return json({
        settings: {
          'media.transport_default': 'mse', 'media.max_live_sessions': o.mediaCap, 'media.wall_profile': o.lanWall, 'snapshots.max_age_s': 5, // < 10 s: the wall refreshes snapshot tiles every max(10, this) s
          'remote.max_live_streams': o.remoteCap, 'remote.wall_profile': o.remoteWall, 'remote.mse_fallback': o.mse ? 'true' : 'false', 'remote.default_profile': 'main',
        },
        can_edit: false,
      });
    }
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(path)) {
      return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    }
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.goto(`/?design=a${hash}`);
  await page.waitForSelector('live-wall');
  return ids;
}

const socks = (page: Page) => page.evaluate(() => (window as unknown as { __socks: Sock[] }).__socks.map((s) => ({ ...s })));
const activeSocks = async (page: Page) => (await socks(page)).filter((s) => !s.closed && !s.refused);
const tile = (page: Page, id: string) => page.locator(`live-wall sw-camera-tile[data-cam="${id}"]`);

test.describe('camera wall under the remote live cap (mocked API, fake relay)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name === 'tablet', 'desktop + phone');
  });

  test('cap 4, 8 cameras: 4 play, 4 show the snapshot with "תמונה · לחץ לצפייה חיה", no ladder walk, no cap error, no retry', async ({ page }) => {
    test.setTimeout(60000);
    await openWall(page, { serverCap: 4 });
    await expect.poll(async () => (await activeSocks(page)).length, { timeout: 15000 }).toBe(4);
    await expect(page.locator('live-wall sw-live-player')).toHaveCount(4);
    for (const id of ['c5', 'c6', 'c7', 'c8']) {
      await expect(tile(page, id).locator('[data-snapshot-label]')).toHaveText('תמונה · לחץ לצפייה חיה');
      await expect(tile(page, id).locator('sw-live-player')).toHaveCount(0);
    }
    await expect(page.locator('live-wall [data-live-cap]')).toHaveCount(0); // the wall stays within the cap: nobody is refused
    await expect(page.locator('live-wall [data-video-badge]').first()).toBeVisible();
    await page.waitForTimeout(3000);
    const all = await socks(page);
    expect(all.length, 'one socket per playing tile: no retry, no ladder step to MSE').toBe(4);
    expect(all.every((s) => s.kind === 'webrtc' && s.profile === 'sub')).toBe(true);
    // a snapshot-only tile refreshes its picture about every 10 s
    const before = await tile(page, 'c5').locator('img.poster').getAttribute('src');
    await expect.poll(() => tile(page, 'c5').locator('img.poster').getAttribute('src'), { timeout: 15000 }).not.toBe(before);
    // a tap opens the single-camera view and the wall lets go of every stream
    await tile(page, 'c5').click();
    await expect(page).toHaveURL(/#\/live\/cameras\/c5/);
    await expect.poll(async () => (await activeSocks(page)).filter((s) => s.camera !== 'c5').length).toBe(0);
  });

  test('a refusal by the server (another tab holds the budget) shows as a cap: the text, who may raise it, no MSE, no retry', async ({ page }) => {
    test.setTimeout(60000);
    // the wall thinks 4 are allowed, the server allows 2: tiles 3 and 4 are refused - c3 with the message, c4 by a bare close 4429
    await openWall(page, { serverCap: 2, silentCams: ['c4'] });
    // N1: the refused tiles sit out as snapshots (their slot is freed, the working budget drops to what really streams)
    await expect(tile(page, 'c3').locator('[data-snapshot-label]')).toHaveText('תמונה · לחץ לצפייה חיה', { timeout: 15000 });
    await expect(tile(page, 'c4').locator('[data-snapshot-label]')).toHaveText('תמונה · לחץ לצפייה חיה', { timeout: 15000 });
    await expect(page.locator('live-wall sw-live-player')).toHaveCount(2);
    await page.waitForTimeout(5000); // longer than the first retry delay (3 s): nothing reconnects, nothing walks the ladder
    const all = await socks(page);
    expect(all.filter((s) => s.camera === 'c3' || s.camera === 'c4').length, 'one attempt each').toBe(2);
    expect(all.some((s) => s.kind === 'mse')).toBe(false);
    expect(all.length).toBe(4);
    expect((await activeSocks(page)).map((s) => s.camera).sort()).toEqual(['c1', 'c2']);
  });

  for (const admin of [false, true]) {
    test(`the cap text on a player (${admin ? 'user who may configure' : 'other user'}): the count, who may raise it, no badge, no generic error`, async ({ page }) => {
      await openWall(page, { serverCap: 1, admin });
      await expect.poll(async () => (await activeSocks(page)).length, { timeout: 15000 }).toBe(1);
      const text = await page.evaluate(async () => {
        const p = document.createElement('sw-live-player') as HTMLElement & { cameraId: string; plan: string; updateComplete: Promise<boolean> };
        p.cameraId = 'cx';
        p.plan = 'main:webrtc,main:mse';
        p.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:200px;z-index:9999';
        document.body.append(p);
        await new Promise((r) => setTimeout(r, 1500));
        const root = p.shadowRoot!;
        return { title: root.querySelector('[data-player-error]')?.textContent, hint: root.querySelector('[data-live-cap-hint]')?.textContent, badge: root.querySelectorAll('[data-video-badge]').length };
      });
      expect(text.title).toBe('הגעת למכסת הזרמים החיים בחיבור הזה (1)');
      expect(text.hint).toBe(admin ? 'אפשר להגדיל בהגדרות › מערכת › גישה מרחוק' : 'פנה למנהל המערכת');
      expect(text.badge).toBe(0);
      await page.waitForTimeout(4000);
      const cx = (await socks(page)).filter((s) => s.camera === 'cx');
      expect(cx.length, 'one attempt, no retry, no ladder step').toBe(1);
      expect(cx[0].kind).toBe('webrtc');
    });
  }

  test('B1: a wall re-used for another selection (map pick → all cameras) gives every visible tile a stream', async ({ page }) => {
    await openWall(page, { cams: 10, remoteCap: 16, mediaCap: 16 }, '#/live/wall?cameras=c5,c9');
    await expect(page.locator('live-wall sw-live-player')).toHaveCount(2, { timeout: 15000 });
    await page.evaluate(() => (location.hash = '#/live/wall'));
    await expect(page.locator('live-wall sw-camera-tile')).toHaveCount(10, { timeout: 10000 });
    await expect(tile(page, 'c1').locator('sw-live-player')).toHaveCount(1, { timeout: 15000 });
    await expect(tile(page, 'c2').locator('sw-live-player')).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator('live-wall sw-live-player')).toHaveCount(10, { timeout: 15000 });
    await expect(page.locator('live-wall [data-snapshot-label]')).toHaveCount(0);
  });

  test('the budget note: 11 cameras under a cap of 8 say how many are live and which setting binds', async ({ page }) => {
    await openWall(page, { cams: 11, remoteCap: 16, mediaCap: 8 });
    await expect(page.locator('live-wall [data-wall-cap-note]')).toHaveText('מוצגות 8 מצלמות חיות מתוך 11 · המכסה: הגדרות › מדיה', { timeout: 15000 });
    await expect(page.locator('live-wall [data-snapshot-label]')).toHaveCount(3);
  });

  test('the default budget shows the whole 11-camera wall live (16), with no note', async ({ page }) => {
    await openWall(page, { cams: 11, remoteCap: 16, mediaCap: 16 });
    await expect(page.locator('live-wall sw-live-player')).toHaveCount(11, { timeout: 15000 });
    await expect(page.locator('live-wall [data-wall-cap-note]')).toHaveCount(0);
  });

  test('LAN channel: the remote cap does not apply (the 8 tiles all stream), and the wall plays media.wall_profile', async ({ page }) => {
    await openWall(page, { channel: 'local', remoteCap: 2, lanWall: 'sub', remoteWall: 'main' });
    await expect.poll(async () => (await activeSocks(page)).length, { timeout: 15000 }).toBe(8);
    expect((await socks(page)).every((s) => s.profile === 'sub')).toBe(true);
    await expect(page.locator('live-wall [data-snapshot-label]')).toHaveCount(0);
  });
});

test.describe('wall quality: installation setting, per-device switch, the remote ladder (mocked API, fake relay)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name === 'tablet', 'desktop + phone');
  });

  test('remote: remote.wall_profile main plays main; the badge tells the truth per tile (main·WebRTC, main·MSE for an H.265 main)', async ({ page }) => {
    await openWall(page, { cams: 4, remoteWall: 'main', main265: ['c2'] });
    await expect(page.locator('[data-wall-quality]')).toHaveValue('auto');
    await expect(tile(page, 'c1').locator('[data-video-badge]')).toHaveAttribute('data-step', 'main·WebRTC', { timeout: 15000 });
    await expect(tile(page, 'c1').locator('[data-video-badge]')).toHaveAttribute('data-state', 'playing', { timeout: 15000 });
    await expect(tile(page, 'c2').locator('[data-video-badge]')).toHaveAttribute('data-step', 'main·MSE', { timeout: 15000 });
    expect((await socks(page)).every((s) => s.profile === 'main')).toBe(true);
  });

  test('remote: the device switch overrides the installation setting at once, is remembered per device, and survives a reload', async ({ page }) => {
    test.setTimeout(60000);
    await openWall(page, { cams: 4, remoteWall: 'sub' });
    await expect(page.locator('[data-wall-quality]')).toHaveValue('auto');
    await expect(tile(page, 'c1').locator('[data-video-badge]')).toHaveAttribute('data-step', 'sub·WebRTC', { timeout: 15000 });
    await page.locator('[data-wall-quality]').selectOption('main');
    await expect(tile(page, 'c1').locator('[data-video-badge]')).toHaveAttribute('data-step', 'main·WebRTC', { timeout: 15000 });
    expect(await page.evaluate(() => localStorage.getItem('sw.wall.quality'))).toBe('main');
    const s = await socks(page);
    expect(s.filter((x) => !x.closed && !x.refused).every((x) => x.profile === 'main'), 'the sub streams were let go').toBe(true);
    await page.reload();
    await page.waitForSelector('live-wall');
    await expect(page.locator('[data-wall-quality]')).toHaveValue('main');
    await expect(tile(page, 'c1').locator('[data-video-badge]')).toHaveAttribute('data-step', 'main·WebRTC', { timeout: 15000 });
    expect((await socks(page)).every((x) => x.profile === 'main')).toBe(true);
    // back to the installation default: this device's choice is forgotten
    await page.locator('[data-wall-quality]').selectOption('auto');
    await expect(tile(page, 'c1').locator('[data-video-badge]')).toHaveAttribute('data-step', 'sub·WebRTC', { timeout: 15000 });
    expect(await page.evaluate(() => localStorage.getItem('sw.wall.quality'))).toBeNull();
  });

  test('LAN: unchanged - media.wall_profile decides, the switch overrides it for this device only', async ({ page }) => {
    await openWall(page, { cams: 4, channel: 'local', lanWall: 'main', remoteWall: 'sub' });
    await expect(page.locator('[data-wall-quality]')).toHaveValue('auto');
    await expect.poll(async () => (await activeSocks(page)).length, { timeout: 15000 }).toBe(4);
    expect((await socks(page)).every((s) => s.profile === 'main')).toBe(true);
    await expect(page.locator('live-wall [data-video-badge]')).toHaveCount(0); // no plan on the LAN
    await page.locator('[data-wall-quality]').selectOption('sub');
    await expect.poll(async () => (await activeSocks(page)).every((s) => s.profile === 'sub') && (await activeSocks(page)).length === 4).toBe(true);
  });
});

test.describe('visible tiles only (mocked API, fake relay)', () => {
  test('a phone-sized window streams the tiles in view; scrolling starts the new ones and releases the left ones after ~5 s', async ({ page }, testInfo) => {
    test.setTimeout(90000);
    testInfo.skip(testInfo.project.name !== 'mobile', 'the phone project');
    await page.setViewportSize({ width: 390, height: 520 });
    await openWall(page, { cams: 20, channel: 'remote', remoteCap: 32, mediaCap: 32 });
    await expect.poll(async () => (await activeSocks(page)).length, { timeout: 15000 }).toBeGreaterThan(0);
    const first = (await activeSocks(page)).length;
    expect(first, 'not every tile streams: the ones far below the window do not').toBeLessThan(20);
    expect((await activeSocks(page)).some((s) => s.camera === 'c20')).toBe(false);
    // scroll to the bottom by every scroller there is (the page or the app's content area)
    await page.evaluate(() => {
      const all: Element[] = [document.scrollingElement as Element];
      const walk = (root: Document | ShadowRoot | Element) => root.querySelectorAll('*').forEach((el) => { all.push(el); if (el.shadowRoot) walk(el.shadowRoot); });
      walk(document);
      for (const el of all) if (el && el.scrollHeight > el.clientHeight + 50) el.scrollTop = el.scrollHeight;
    });
    await expect.poll(async () => (await activeSocks(page)).some((s) => s.camera === 'c20'), { timeout: 15000 }).toBe(true);
    // the top tiles left the view: let go (server side: the socket closes, the registry entry is popped) after ~5 s
    await expect.poll(async () => (await activeSocks(page)).some((s) => s.camera === 'c1'), { timeout: 15000 }).toBe(false);
    const closed = (await socks(page)).find((s) => s.camera === 'c1')!;
    expect(closed.closed).toBe(true);
  });
});
