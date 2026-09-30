import { test, expect, type Page } from '@playwright/test';

// 0.1.148 owner bug (the 'oliel' installation, LAN): on the all-cameras wall (quality "ברירת מחדל" = sub, transport
// WebRTC) two panoramic cameras stayed on "WebRTC התחבר אך הדפדפן לא מפענח את הזרם הזה — בחר MSE או אוטומטי", while the
// camera page played their MAIN profile over WebRTC. The wall tile now falls back (bounded) and remembers per camera the
// step that played; a profile the viewer fixed is never switched.
//
// No backend: the built app (npx vite build; the preview serves dist/, SW_BASE_URL for another port), the API answered by
// page.route. The browser media stack is a fake (as in evidence-remote-video.spec.ts): a live socket that answers the
// offer, and an RTCPeerConnection with RTP statistics whose outcome per profile is set by the test:
//   ok        connects and delivers a canvas stream (a real <video> "playing" event)
//   fail      never connects (ICE `failed`)
//   nodecode  connects, bytes arrive, no frame ever decodes (the panoramic sub stream of the owner report)
// One camera streams (c2, the panoramic one); c1 is snapshot-only (can_view_live=false), so the fake peer connection
// always belongs to c2. What it does not prove: the real codec of the owner's sub streams (the lab / owner check).

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const UNDECODABLE = 'WebRTC התחבר אך הדפדפן לא מפענח את הזרם הזה — בחר MSE או אוטומטי';

type RtcMode = 'ok' | 'fail' | 'nodecode';

const FAKE_MEDIA = () => {
  const w = window as unknown as Record<string, unknown>;
  w.__liveSockets = [] as { profile: string; camera: string; kind: string }[];
  const modeOf = (profile: string) => ((w.__rtc as Record<string, string>) ?? {})[profile] ?? 'ok';
  const RealWS = window.WebSocket;
  class FakeLive {
    url: string;
    readyState = 0;
    binaryType = 'blob';
    entry: { profile: string; camera: string; kind: string };
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(url: string) {
      this.url = url;
      const u = new URL(url);
      const profile = u.searchParams.get('profile') || 'sub';
      this.entry = { profile, camera: (/\/media\/live\/([^/]+)\/ws/.exec(u.pathname) ?? [])[1] ?? '', kind: '' };
      (w.__liveSockets as unknown[]).push(this.entry);
      w.__lastProfile = profile;
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      }, 20);
    }
    private reply(body: unknown) {
      setTimeout(() => this.readyState === 1 && this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(body) })), 20);
    }
    send(data: string) {
      const msg = JSON.parse(data) as { type: string };
      if (msg.type === 'webrtc/offer') {
        this.entry.kind = 'webrtc';
        this.reply({ type: 'webrtc/answer', value: 'v=0 fake-answer' });
      } else if (msg.type === 'mse') {
        this.entry.kind = 'mse';
        this.reply({ type: 'mse', value: 'video/mp4; codecs="avc1.640029"' });
      }
    }
    close() {
      this.readyState = 3;
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
    private mode = modeOf(String(w.__lastProfile));
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
    private state(s: string) {
      this.connectionState = s;
      this.onconnectionstatechange?.();
    }
    private play() {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 90; // 32:9, the panoramic shape
      const ctx = c.getContext('2d')!;
      let n = 0;
      this.timers.push(window.setInterval(() => {
        ctx.fillStyle = n++ % 2 ? '#1d4ed8' : '#16a34a';
        ctx.fillRect(0, 0, 320, 90);
        this.bytes += 4000;
        this.frames += 1;
      }, 100));
      const stream = c.captureStream(10);
      this.ontrack?.({ streams: [stream], track: stream.getVideoTracks()[0] });
    }
    async setRemoteDescription() {
      if (this.mode === 'fail') return this.later(60, () => this.state('failed'));
      this.later(60, () => this.state('connected'));
      if (this.mode === 'ok') return this.later(80, () => this.play());
      if (this.mode === 'nodecode') return this.timers.push(window.setInterval(() => (this.bytes += 4000), 100));
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

async function openWall(page: Page, opts: { rtc: Record<string, RtcMode>; transport: 'webrtc' | 'auto' | 'mse'; quality?: 'sub' | 'main'; works?: string }) {
  await page.addInitScript((o) => {
    const w = window as unknown as Record<string, unknown>;
    w.__rtc = o.rtc;
    if (!sessionStorage.getItem('pano-init')) {
      // first load of this test only: a reload keeps what the player remembered
      sessionStorage.setItem('pano-init', '1');
      localStorage.setItem('sw.wall.count', '32');
      if (o.quality) localStorage.setItem('sw.wall.quality', o.quality);
      else localStorage.removeItem('sw.wall.quality');
      if (o.works) localStorage.setItem('sw.live.works', o.works);
      else localStorage.removeItem('sw.live.works');
    }
  }, opts);
  await page.addInitScript(FAKE_MEDIA);
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live'];
      return json({
        user: { id: 'u', username: 'dana', display_name: 'Dana', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'cameras') {
      const cam = (id: string, i: number, live: boolean, name: string) => ({
        id, recorder_id: 'r', channel: i + 1, name, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 1, sub_track: 2,
        status: 'online', last_seen_at: null, can_view_live: live,
        // GOP 2 s on both profiles: the decode grace is 6 s
        encoding: { main: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 }, sub: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 } },
      });
      return json({ cameras: [cam('c1', 0, false, 'Gate'), cam('c2', 1, true, 'Street')], recorder: null, can_sync: false, media: {} });
    }
    if (p === 'settings') return json({ settings: { 'media.transport_default': opts.transport, 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60 }, can_edit: false });
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
  await page.goto('/?design=a#/live/wall');
  await page.waitForSelector('live-wall');
  await expect(player(page)).toHaveCount(1, { timeout: 15000 });
}

const player = (page: Page) => page.locator('live-wall sw-camera-tile[data-cam="c2"] sw-live-player');
const status = (page: Page) => player(page).evaluate((p) => (p as unknown as { status: string }).status);
const transport = (page: Page) => player(page).evaluate((p) => (p as unknown as { transport: string }).transport);
const sockets = (page: Page) =>
  page.evaluate(() => (window as unknown as { __liveSockets: { profile: string; camera: string; kind: string }[] }).__liveSockets.map(({ camera, profile, kind }) => `${camera}:${profile}:${kind}`));
const works = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('sw.live.works') ?? '{}') as Record<string, { step: string }>);

test.describe('wall: a panoramic camera whose sub stream does not decode over WebRTC (0.1.148 owner bug)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'layout-independent player logic');
  });

  test('default quality + WebRTC: sub connects, decodes nothing -> main over WebRTC plays and is remembered; a reload starts there', async ({ page }) => {
    test.setTimeout(60000);
    await openWall(page, { rtc: { sub: 'nodecode', main: 'ok' }, transport: 'webrtc' });
    await expect.poll(() => status(page), { timeout: 20000 }).toBe('playing');
    expect(await transport(page)).toBe('webrtc');
    expect(await sockets(page)).toEqual(['c2:sub:webrtc', 'c2:main:webrtc']);
    await expect(player(page).locator('[data-player-error]')).toHaveCount(0);
    expect((await works(page))['c2|sub|webrtc']?.step).toBe('main:webrtc');
    await page.screenshot({ path: test.info().outputPath('wall-pano-main-webrtc.png') });

    await page.reload();
    await page.waitForSelector('live-wall');
    await expect.poll(() => status(page), { timeout: 10000 }).toBe('playing');
    expect(await sockets(page), 'the remembered step first: no second 6 s wait on the undecodable sub').toEqual(['c2:main:webrtc']);
  });

  test('a fixed quality (the viewer chose sub) is never switched: the message, no other profile, no retry loop', async ({ page }) => {
    test.setTimeout(60000);
    await openWall(page, { rtc: { sub: 'nodecode', main: 'ok' }, transport: 'webrtc', quality: 'sub' });
    await expect(player(page).locator('[data-player-error]')).toHaveText(UNDECODABLE, { timeout: 20000 });
    await page.waitForTimeout(5000); // the first automatic retry would come after 3 s
    expect(await sockets(page)).toEqual(['c2:sub:webrtc']);
    expect(await works(page)).toEqual({});
  });

  test('a remembered step that fails is forgotten and the chain continues from the requested profile', async ({ page }) => {
    test.setTimeout(60000);
    await openWall(page, {
      rtc: { sub: 'ok', main: 'fail' },
      transport: 'webrtc',
      works: JSON.stringify({ 'c2|sub|webrtc': { step: 'main:webrtc', at: Date.now() } }),
    });
    await expect.poll(() => status(page), { timeout: 20000 }).toBe('playing');
    expect(await sockets(page)).toEqual(['c2:main:webrtc', 'c2:sub:webrtc']);
    expect(await works(page)).toEqual({}); // the chain's own first step played: nothing left to remember
  });

  test('a connection failure (not a decode failure) never switches the profile', async ({ page }) => {
    test.setTimeout(60000);
    await openWall(page, { rtc: { sub: 'fail', main: 'ok' }, transport: 'webrtc' });
    await expect(player(page).locator('[data-player-error]')).toBeVisible({ timeout: 20000 });
    expect(await sockets(page)).toEqual(['c2:sub:webrtc']);
  });
});
