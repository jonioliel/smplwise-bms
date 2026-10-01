import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

// CR-008 step 6 (D7) - the remote video policy, against the fixture backend tests/fixtures/setup_fake_devices.py (the
// real backend; its NVR and go2rtc are fakes on `.test` hosts - how to start it is at the top of that file):
//
//   SW_LIVE=1 SW_SETUP_FIXTURE=1 SW_API_PORT=8349 SW_SETUP_CONTROL=http://127.0.0.1:8359 \
//     SW_BASE_URL=http://127.0.0.1:4189/ npx playwright test tests/evidence-remote-video.spec.ts --project=desktop --workers=1
//
// The fake NVR's streaming channels are set per test (control API), and the backend's own camera sync reads them into
// the capability registry. The remote channel is what the SERVER says (`/me.channel`, `/me.remote`): the spec answers
// /me through the real backend and marks it remote with the two settings under test (the /arx sign-in itself is
// evidence-arx-remote.spec.ts). The browser's media stack is replaced by an init script: a fake live socket (the relay's
// signalling: offer → answer, `mse` → the MIME reply) and a fake RTCPeerConnection with RTP statistics, whose outcome
// per profile is set by the test:
//   ok        connects and delivers a canvas stream (a real <video> "playing" event)
//   fail      never connects (ICE `failed`)
//   nodecode  connects, bytes arrive, no frame ever decodes (the lab's main stream)
//   slow      connects, but no media arrives for 13 s - then the first frame (a long GOP over a slow link)
//   flap      connects, goes `disconnected` for a moment, recovers, then plays
//   down      the relay answers the offer with `upstream_unavailable` (go2rtc down)
//   slowoffer createOffer takes 800 ms, then as ok (a camera switch during it)
//   noplay    connects and frames DECODE (statistics), but no track reaches <video> - no `playing` event (a background
//             tab's deferred autoplay)
// `window.__hidden` (set before load) makes document.hidden / visibilityState report a background tab.
// What it does not prove: real go2rtc WebRTC / MSE media (the lab check).

const CONTROL = process.env.SW_SETUP_CONTROL || 'http://127.0.0.1:8359';
const MAIN_UNDECODABLE = 'הזרם הראשי אינו ניתן לפענוח ב-WebRTC - ראה הגדרות › וידאו';

type RtcMode = 'ok' | 'fail' | 'nodecode' | 'slow' | 'flap' | 'down' | 'slowoffer' | 'noplay';
interface SocketEntry {
  profile: string;
  camera: string;
  kind: string;
  offers: number;
}

const FAKE_MEDIA = () => {
  const w = window as unknown as Record<string, unknown>;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!w.__hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (w.__hidden ? 'hidden' : 'visible') });
  // the player's first-frame watch listeners (re-review F1): count the live ones
  const watchers = new Set<unknown>();
  w.__watchListeners = () => watchers.size;
  const isWatch = (fn: unknown) => typeof fn === 'function' && /generation/.test(String(fn)) && /hidden/.test(String(fn));
  const add = document.addEventListener.bind(document);
  const remove = document.removeEventListener.bind(document);
  document.addEventListener = ((type: string, fn: EventListener, opts?: unknown) => {
    if (type === 'visibilitychange' && isWatch(fn)) watchers.add(fn);
    return add(type, fn, opts as AddEventListenerOptions);
  }) as typeof document.addEventListener;
  document.removeEventListener = ((type: string, fn: EventListener, opts?: unknown) => {
    if (type === 'visibilitychange') watchers.delete(fn);
    return remove(type, fn, opts as EventListenerOptions);
  }) as typeof document.removeEventListener;
  // autoplay refused once (iOS Low Power Mode) when __blockAutoplay is set (re-review F2); play() calls are counted
  const realPlay = HTMLMediaElement.prototype.play;
  w.__playCalls = 0;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    if (w.__blockAutoplay) {
      w.__blockAutoplay = false;
      return Promise.reject(new DOMException('autoplay refused', 'NotAllowedError'));
    }
    w.__playCalls = (w.__playCalls as number) + 1;
    return realPlay.call(this);
  };
  w.__liveSockets = [] as SocketEntry[];
  w.__rtc = (w.__rtc as Record<string, string>) ?? { main: 'ok', sub: 'ok' };
  const modeOf = (profile: string) => (w.__rtc as Record<string, string>)[profile] ?? 'ok';
  const RealWS = window.WebSocket;
  class FakeLive {
    url: string;
    readyState = 0;
    binaryType = 'blob';
    entry: SocketEntry;
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(url: string) {
      this.url = url;
      const u = new URL(url);
      const profile = u.searchParams.get('profile') || 'sub';
      this.entry = { profile, camera: (/\/media\/live\/([^/]+)\/ws/.exec(u.pathname) ?? [])[1] ?? '', kind: '', offers: 0 };
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
        this.entry.offers += 1;
        if (modeOf(this.entry.profile) === 'down') this.reply({ type: 'error', value: 'upstream_unavailable' });
        else this.reply({ type: 'webrtc/answer', value: 'v=0 fake-answer' });
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
      if (this.mode === 'slowoffer') await new Promise((r) => setTimeout(r, 800));
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
      c.height = 180;
      const ctx = c.getContext('2d')!;
      let n = 0;
      this.timers.push(window.setInterval(() => {
        ctx.fillStyle = n++ % 2 ? '#1d4ed8' : '#16a34a';
        ctx.fillRect(0, 0, 320, 180);
        this.bytes += 4000;
        this.frames += 1;
      }, 100));
      const stream = c.captureStream(10);
      this.ontrack?.({ streams: [stream], track: stream.getVideoTracks()[0] });
    }
    async setRemoteDescription() {
      const mode = this.mode;
      if (mode === 'fail') return this.later(60, () => this.state('failed'));
      this.later(60, () => this.state('connected'));
      if (mode === 'ok' || mode === 'slowoffer') return this.later(80, () => this.play());
      if (mode === 'nodecode') return this.timers.push(window.setInterval(() => (this.bytes += 4000), 100));
      if (mode === 'slow') return this.later(13000, () => this.play());
      if (mode === 'noplay') return this.timers.push(window.setInterval(() => ((this.bytes += 4000), (this.frames += 1)), 100));
      if (mode === 'flap') {
        this.later(300, () => this.state('disconnected'));
        this.later(1000, () => this.state('connected'));
        this.later(2000, () => this.play());
      }
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

/** The notes about how the stream plays (banner, hint) are off by default (media.video_notices, owner 2026-10-01): these specs assert
 * them, so the installation setting is switched on for the page; `evidence-webrtc-only.spec.ts` covers the default. */
async function noticesOn(page: Page) {
  await page.route(/\/api\/v1\/settings(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    body.settings = { ...(body.settings ?? {}), 'media.video_notices': 'true' };
    await route.fulfill({ response, json: body });
  });
}

async function remoteMe(page: Page, remote: { profile: 'main' | 'sub'; mse: boolean }) {
  await noticesOn(page);
  await page.route(/\/api\/v1\/me(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const me = await response.json();
    me.channel = 'remote';
    me.remote = { 'remote.policy': 'flag', 'remote.session': 'rolling_90d', 'remote.idle_lock_minutes': 720, 'remote.default_profile': remote.profile, 'remote.mse_fallback': remote.mse ? 'true' : 'false' };
    await route.fulfill({ response, json: me });
  });
}

async function openCamera(page: Page, cameraId: string, rtc: Record<string, RtcMode>) {
  await page.addInitScript((modes) => {
    (window as unknown as Record<string, unknown>).__rtc = modes;
  }, rtc);
  await page.addInitScript(FAKE_MEDIA);
  await page.goto(`/?design=a#/live/cameras/${cameraId}`);
  await page.waitForSelector('sw-app');
}

const player = (page: Page) => page.locator('live-camera sw-live-player');
const badge = (page: Page) => player(page).locator('[data-video-badge]');
const status = (page: Page) => player(page).evaluate((p) => (p as unknown as { status: string }).status);
const watchListeners = (page: Page) => page.evaluate(() => (window as unknown as { __watchListeners: () => number }).__watchListeners());
const sockets = (page: Page) => page.evaluate(() => (window as unknown as { __liveSockets: SocketEntry[] }).__liveSockets.map(({ profile, kind }) => ({ profile, kind })));

/** The badge says what PLAYS only while it plays; before that "מנסה <step>…". */
async function expectPlaying(page: Page, step: string, timeout = 15000) {
  await expect(badge(page)).toHaveAttribute('data-state', 'playing', { timeout });
  await expect(badge(page)).toHaveAttribute('data-step', step);
  await expect(badge(page)).toHaveText(step);
}

test.describe('remote video policy against the fixture backend (fake NVR / go2rtc)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_SETUP_FIXTURE !== '1', 'set SW_LIVE=1 SW_SETUP_FIXTURE=1 against tests/fixtures/setup_fake_devices.py');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;
  let request: APIRequestContext;
  let h264Camera = '';
  let h265Camera = '';

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name === 'tablet', 'desktop + phone (the policy is layout-independent)');
  });

  test.beforeAll(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name === 'tablet', 'desktop + phone');
    control = await pwRequest.newContext({ baseURL: CONTROL });
    request = await pwRequest.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    expect((await control.post('/reset')).status()).toBe(200);
    // channel 1: main H.265 (cannot play over WebRTC); every other channel: main H.264 without SVC / B-frames
    const set = await control.post('/nvr', {
      data: {
        encodings: { main: { codec: 'H.264', svc: false, width: 2560, height: 1440 }, sub: { codec: 'H.264', width: 640, height: 360 } },
        encodings_by_channel: { '1': { main: { codec: 'H.265' } } },
      },
    });
    expect(set.status()).toBe(200);
    expect((await request.post('/api/v1/cameras/sync')).status()).toBe(200);
    const cams = (await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; channel: number; encoding: { main: { webrtc: string } } }[];
    const one = cams.find((c) => c.channel === 1)!;
    const two = cams.find((c) => c.channel === 2)!;
    expect(one.encoding.main.webrtc).toBe('no');
    expect(two.encoding.main.webrtc).toBe('ok');
    h265Camera = one.id;
    h264Camera = two.id;
  });

  test.afterAll(async () => {
    await control?.post('/reset');
    await control?.dispose();
    await request?.dispose();
  });

  test('remote default main: "מנסה" while connecting, then main·WebRTC plays, no fallback notice', async ({ page }) => {
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'ok', sub: 'ok' });
    await expectPlaying(page, 'main·WebRTC');
    await expect(player(page).locator('[data-video-notice]')).toHaveCount(0);
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }]);
    expect(await watchListeners(page), 're-review F1: the first-frame watch ends on `playing`').toBe(0);
    await expect(page.locator('live-camera [data-remote-video-policy]')).toContainText('WebRTC תחילה');
    await page.screenshot({ path: test.info().outputPath('remote-main-webrtc.png') });
  });

  test('a forced WebRTC failure falls back to MSE when remote.mse_fallback allows it (announced)', async ({ page }) => {
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'fail', sub: 'ok' });
    await expect(badge(page)).toHaveAttribute('data-step', 'main·MSE', { timeout: 15000 });
    await expect(badge(page)).toHaveText('מנסה main·MSE…'); // no fMP4 in this fake: it never claims to play
    await expect(player(page).locator('[data-video-notice]')).toContainText('MSE דרך המנהרה');
    await expect.poll(() => sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }, { profile: 'main', kind: 'mse' }]);
    expect(await watchListeners(page), 're-review F1: the failed WebRTC step left no listener behind').toBe(0);
    await page.screenshot({ path: test.info().outputPath('remote-main-mse-fallback.png') });
  });

  test('review M2: a first frame at 13 s still plays over WebRTC (no bytes yet = keep waiting)', async ({ page }) => {
    test.setTimeout(60000);
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'slow', sub: 'ok' });
    await page.waitForTimeout(12500);
    await expect(badge(page)).toHaveText('מנסה main·WebRTC…');
    await expectPlaying(page, 'main·WebRTC', 10000);
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }]);
  });

  test('review M2: a transient "disconnected" before the first frame is not a failure', async ({ page }) => {
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'flap', sub: 'ok' });
    await expectPlaying(page, 'main·WebRTC');
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }]);
  });

  test('re-review: frames decoding without a `playing` event is never a failure (no fallback past the 30 s cap)', async ({ page }) => {
    test.setTimeout(60000);
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'noplay', sub: 'ok' });
    await page.waitForTimeout(34000);
    await expect(badge(page)).toHaveAttribute('data-step', 'main·WebRTC');
    expect(await status(page)).toBe('connecting');
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }]);
    await expect(player(page).locator('[data-video-notice]')).toHaveCount(0);
    await expect(player(page).locator('[data-tap-to-play]')).toHaveCount(0); // play() was not refused here
    expect(await watchListeners(page)).toBe(0);
  });

  test('re-review F2: frames decode but autoplay is refused (NotAllowedError) - "הקש להפעלה", a tap calls play()', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__blockAutoplay = true;
    });
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'noplay', sub: 'ok' });
    const tap = player(page).locator('[data-tap-to-play]');
    await expect(tap).toHaveText('הקש להפעלה', { timeout: 10000 });
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }]); // not a failure: no fallback
    await page.screenshot({ path: test.info().outputPath('remote-tap-to-play.png') });
    const before = await page.evaluate(() => (window as unknown as { __playCalls: number }).__playCalls);
    await tap.click();
    await expect(tap).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __playCalls: number }).__playCalls)).toBe(before + 1);
  });

  test('re-review: the hidden-tick path alone (document.hidden turns false, no event) judges on a fresh clock', async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__hidden = true;
    });
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'nodecode', sub: 'ok' }); // decode grace 6 s
    await page.waitForTimeout(10000);
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }]);
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__hidden = false; // no visibilitychange dispatched
    });
    const visibleAt = Date.now();
    await expect(badge(page)).toHaveAttribute('data-step', 'main·MSE', { timeout: 15000 });
    const took = Date.now() - visibleAt;
    expect(took, 'about the grace period after the tab became visible (the clock restarted at the last hidden tick)').toBeGreaterThanOrEqual(4000);
    expect(took).toBeLessThan(12000);
  });

  test('re-review: no judgement while the tab is hidden; the clock restarts when it is visible again', async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__hidden = true;
    });
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'nodecode', sub: 'ok' }); // decode grace here: 6 s (GOP 2 s + 3 s, min 6 s)
    await page.waitForTimeout(12000);
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }]); // hidden twice the grace: still the first step
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const visibleAt = Date.now();
    await expect(badge(page)).toHaveAttribute('data-step', 'main·MSE', { timeout: 15000 });
    expect(Date.now() - visibleAt, 'judged on a fresh clock after the tab became visible').toBeGreaterThanOrEqual(5000);
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }, { profile: 'main', kind: 'mse' }]);
  });

  test('MSE off: main that cannot decode (bytes, no frames) falls to sub·WebRTC with the message', async ({ page }) => {
    test.setTimeout(60000);
    await remoteMe(page, { profile: 'main', mse: false });
    await openCamera(page, h264Camera, { main: 'nodecode', sub: 'ok' });
    await expect(badge(page)).toHaveText('מנסה main·WebRTC…');
    await expectPlaying(page, 'sub·WebRTC', 25000);
    await expect(player(page).locator('[data-video-notice]')).toContainText(MAIN_UNDECODABLE);
    expect((await sockets(page)).every((s) => s.kind !== 'mse')).toBe(true);
  });

  test('MSE off and no WebRTC stream decodes: the message, never MSE', async ({ page }) => {
    test.setTimeout(90000);
    await remoteMe(page, { profile: 'main', mse: false });
    await openCamera(page, h264Camera, { main: 'nodecode', sub: 'nodecode' });
    await expect(player(page).locator('[data-player-error]')).toHaveText(MAIN_UNDECODABLE, { timeout: 40000 });
    await expect(badge(page)).toHaveCount(0);
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }, { profile: 'sub', kind: 'webrtc' }]);
    await page.screenshot({ path: test.info().outputPath('remote-no-mse-message.png') });
  });

  test('go2rtc down: "שרת הווידאו אינו זמין", no raw code, MSE not blamed, the ladder not walked', async ({ page }) => {
    await remoteMe(page, { profile: 'main', mse: false });
    await openCamera(page, h264Camera, { main: 'down', sub: 'down' });
    const err = player(page).locator('[data-player-error]');
    await expect(err).toHaveText('שרת הווידאו אינו זמין', { timeout: 10000 });
    await expect(err).not.toContainText('upstream');
    await expect(err).not.toContainText('MSE');
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }]);
  });

  test('review M3: a camera switch during createOffer never sends the stale offer on the new socket', async ({ page }) => {
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'slowoffer', sub: 'ok' });
    await expect.poll(() => page.evaluate(() => (window as unknown as { __liveSockets: unknown[] }).__liveSockets.length)).toBe(1);
    await player(page).evaluate((p, other) => {
      (p as unknown as { cameraId: string }).cameraId = other; // the same player instance, another camera, mid-createOffer
    }, h265Camera);
    await expectPlaying(page, 'main·WebRTC');
    const all = await page.evaluate(() => (window as unknown as { __liveSockets: SocketEntry[] }).__liveSockets);
    expect(all.map((s) => s.camera)).toEqual([h264Camera, h265Camera]);
    expect(all.map((s) => s.offers)).toEqual([0, 1]);
    expect(await watchListeners(page), 're-review F1: the torn-down attempt left no listener behind').toBe(0);
  });

  test('a main stream the NVR reports as H.265 skips WebRTC: straight to main·MSE (allowed)', async ({ page }) => {
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h265Camera, { main: 'ok', sub: 'ok' });
    await expect(badge(page)).toHaveAttribute('data-step', 'main·MSE');
    await expect.poll(() => sockets(page)).toEqual([{ profile: 'main', kind: 'mse' }]);
    // the camera's capabilities carry the settings hint from the registry
    await expect(page.locator('live-camera [data-caps-webrtc-hint]')).toContainText('מקודד H.265 - לא יתנגן ב-WebRTC; לשינוי: NVR DS-7616NI-FAKE', { timeout: 15000 });
  });

  test("LAN / Ingress channel: no plan, no badge - today's player", async ({ page }) => {
    await openCamera(page, h264Camera, { main: 'ok', sub: 'ok' });
    await expect(player(page)).toBeVisible();
    await page.waitForTimeout(500);
    expect(await player(page).evaluate((p) => (p as unknown as { plan: string }).plan)).toBe('');
    await expect(badge(page)).toHaveCount(0);
    expect(await status(page)).not.toBe('error');
  });

  test('Settings › Remote access: the codec summary line links to the health detail with the hints', async ({ page }) => {
    await page.goto('/?design=a#/system/diagnostics?tab=remote');
    await page.waitForSelector('sw-app');
    const line = page.locator('system-diagnostics [data-remote-codec-summary]');
    await expect(line).toContainText('זרם ראשי: 3 מתוך 4 מצלמות מתנגנים ב־WebRTC · 1 לא יתנגנו');
    await line.locator('[data-remote-codec-link]').click();
    const card = page.locator('system-diagnostics [data-health-card="video_webrtc"]');
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card.locator('[data-video-hint]')).toHaveCount(1);
    await expect(card.locator('[data-video-hint]')).toContainText('הזרם הראשי של מצלמה 1 מקודד H.265');
    await page.screenshot({ path: test.info().outputPath('settings-codec-health.png'), fullPage: true });
  });
});
