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
// signalling: offer → answer, `mse` → the MIME reply) and a fake RTCPeerConnection whose outcome per profile is set by
// the test - `ok` delivers a canvas stream (a real <video> "playing" event), `fail` never connects, `nodecode` connects
// and renders nothing (the lab's main stream). What it does not prove: real go2rtc WebRTC / MSE media (the lab check).

const CONTROL = process.env.SW_SETUP_CONTROL || 'http://127.0.0.1:8359';
const MAIN_UNDECODABLE = 'הזרם הראשי אינו ניתן לפענוח ב-WebRTC - ראה הגדרות › וידאו';

type RtcMode = 'ok' | 'fail' | 'nodecode';

const FAKE_MEDIA = () => {
  const w = window as unknown as Record<string, unknown>;
  w.__liveSockets = [] as { profile: string; kind: string }[];
  w.__rtc = (w.__rtc as Record<string, string>) ?? { main: 'ok', sub: 'ok' };
  const RealWS = window.WebSocket;
  class FakeLive {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    url: string;
    readyState = 0;
    binaryType = 'blob';
    profile: string;
    entry: { profile: string; kind: string };
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(url: string) {
      this.url = url;
      this.profile = new URL(url).searchParams.get('profile') || 'sub';
      this.entry = { profile: this.profile, kind: '' };
      (w.__liveSockets as unknown[]).push(this.entry);
      w.__lastProfile = this.profile;
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      }, 20);
    }
    send(data: string) {
      const msg = JSON.parse(data) as { type: string };
      if (msg.type === 'webrtc/offer') {
        this.entry.kind = 'webrtc';
        setTimeout(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'webrtc/answer', value: 'v=0 fake-answer' }) })), 20);
      } else if (msg.type === 'mse') {
        this.entry.kind = 'mse';
        setTimeout(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'mse', value: 'video/mp4; codecs="avc1.640029"' }) })), 20);
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
    private timer = 0;
    addTransceiver() {}
    async createOffer() {
      return { type: 'offer', sdp: 'v=0 fake-offer' };
    }
    async setLocalDescription() {}
    async addIceCandidate() {}
    async setRemoteDescription() {
      const mode = (w.__rtc as Record<string, string>)[String(w.__lastProfile)] ?? 'ok';
      this.timer = window.setTimeout(() => {
        if (this.connectionState === 'closed') return;
        if (mode === 'fail') {
          this.connectionState = 'failed';
          this.onconnectionstatechange?.();
          return;
        }
        this.connectionState = 'connected';
        this.onconnectionstatechange?.();
        if (mode !== 'ok') return; // nodecode: connected, but no frame ever renders
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 180;
        const ctx = c.getContext('2d')!;
        let n = 0;
        window.setInterval(() => {
          ctx.fillStyle = n++ % 2 ? '#1d4ed8' : '#16a34a';
          ctx.fillRect(0, 0, 320, 180);
        }, 100);
        const stream = c.captureStream(10);
        this.ontrack?.({ streams: [stream], track: stream.getVideoTracks()[0] });
      }, 60);
    }
    close() {
      window.clearTimeout(this.timer);
      this.connectionState = 'closed';
    }
  }
  (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = FakePC;
};

async function remoteMe(page: Page, remote: { profile: 'main' | 'sub'; mse: boolean }) {
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
const sockets = (page: Page) => page.evaluate(() => (window as unknown as { __liveSockets: { profile: string; kind: string }[] }).__liveSockets);

test.describe('remote video policy against the fixture backend (fake NVR / go2rtc)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_SETUP_FIXTURE !== '1', 'set SW_LIVE=1 SW_SETUP_FIXTURE=1 against tests/fixtures/setup_fake_devices.py');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;
  let request: APIRequestContext;
  let h264Camera = '';
  let h265Camera = '';

  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'desktop only (the policy is layout-independent)');
  });

  test.beforeAll(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'desktop only');
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

  test('remote default main: main·WebRTC plays, no fallback notice', async ({ page }) => {
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'ok', sub: 'ok' });
    await expect(player(page).locator('[data-video-badge]')).toHaveText('main·WebRTC');
    await expect.poll(() => player(page).evaluate((p) => (p as unknown as { status: string }).status), { timeout: 15000 }).toBe('playing');
    await expect(player(page).locator('[data-video-notice]')).toHaveCount(0);
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }]);
    await expect(page.locator('live-camera [data-remote-video-policy]')).toContainText('WebRTC תחילה');
    await page.screenshot({ path: test.info().outputPath('remote-main-webrtc.png') });
  });

  test('a forced WebRTC failure falls back to MSE when remote.mse_fallback allows it (announced)', async ({ page }) => {
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h264Camera, { main: 'fail', sub: 'ok' });
    await expect(player(page).locator('[data-video-badge]')).toHaveText('main·MSE', { timeout: 15000 });
    await expect(player(page).locator('[data-video-notice]')).toContainText('MSE דרך המנהרה');
    await expect.poll(() => sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }, { profile: 'main', kind: 'mse' }]);
    await page.screenshot({ path: test.info().outputPath('remote-main-mse-fallback.png') });
  });

  test('MSE off: main that cannot decode falls to sub·WebRTC with the message', async ({ page }) => {
    test.setTimeout(60000);
    await remoteMe(page, { profile: 'main', mse: false });
    await openCamera(page, h264Camera, { main: 'nodecode', sub: 'ok' });
    await expect(player(page).locator('[data-video-badge]')).toHaveText('main·WebRTC');
    await expect(player(page).locator('[data-video-badge]')).toHaveText('sub·WebRTC', { timeout: 20000 }); // the 12 s frame deadline
    await expect(player(page).locator('[data-video-notice]')).toContainText(MAIN_UNDECODABLE);
    await expect.poll(() => player(page).evaluate((p) => (p as unknown as { status: string }).status), { timeout: 10000 }).toBe('playing');
    expect((await sockets(page)).every((s) => s.kind !== 'mse')).toBe(true);
  });

  test('MSE off and no WebRTC stream decodes: the message, never MSE', async ({ page }) => {
    test.setTimeout(90000);
    await remoteMe(page, { profile: 'main', mse: false });
    await openCamera(page, h264Camera, { main: 'nodecode', sub: 'nodecode' });
    await expect(player(page).locator('[data-player-error]')).toHaveText(MAIN_UNDECODABLE, { timeout: 40000 });
    await expect(player(page).locator('[data-video-badge]')).toHaveCount(0);
    expect(await sockets(page)).toEqual([{ profile: 'main', kind: 'webrtc' }, { profile: 'sub', kind: 'webrtc' }]);
    await page.screenshot({ path: test.info().outputPath('remote-no-mse-message.png') });
  });

  test('a main stream the NVR reports as H.265 skips WebRTC: straight to main·MSE (allowed)', async ({ page }) => {
    await remoteMe(page, { profile: 'main', mse: true });
    await openCamera(page, h265Camera, { main: 'ok', sub: 'ok' });
    await expect(player(page).locator('[data-video-badge]')).toHaveText('main·MSE');
    await expect.poll(() => sockets(page)).toEqual([{ profile: 'main', kind: 'mse' }]);
    // the camera's capabilities carry the settings hint from the registry
    await expect(page.locator('live-camera [data-caps-webrtc-hint]')).toContainText('מקודד H.265 - לא יתנגן ב-WebRTC; לשינוי: NVR DS-7616NI-FAKE', { timeout: 15000 });
  });

  test('LAN / Ingress channel: no plan, no badge - today\'s player', async ({ page }) => {
    await openCamera(page, h264Camera, { main: 'ok', sub: 'ok' });
    await expect(player(page)).toBeVisible();
    await page.waitForTimeout(500);
    expect(await player(page).evaluate((p) => (p as unknown as { plan: string }).plan)).toBe('');
    await expect(player(page).locator('[data-video-badge]')).toHaveCount(0);
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
