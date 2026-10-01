import { test, expect, type Page } from '@playwright/test';

// Owner 2026-10-01: live video over WebRTC works from a desktop browser outside the site but not from the owner's
// Android phone (VPN + 4G). הגדרות › גישה מרחוק › בדיקת חיבור וידאו shows what the WebRTC stack of the browser that
// shows the card does against the live relay. No backend: the built app (npx vite build; the preview serves dist/,
// SW_BASE_URL for another port), the API answered by page.route, and the browser media stack a fake (as in
// evidence-webrtc-only.spec.ts): a live relay socket (offer -> answer with candidates + trickle candidate) and an
// RTCPeerConnection whose outcome per profile is set by the test:
//   ok        connects, ICE srflx, decodes frames
//   ice       never connects (ICE `failed`), candidates both ways
//   nodecode  connects, bytes arrive, no frame ever decodes
//   hang      ICE stays `checking` for ever (the test leaves the page mid-run)
//   cap       the relay refuses with remote_live_cap (max 2) and closes 4429
// Every fake address below is a documentation address; the checks prove none of them reaches the report.
// SW_SHOTS=<dir> also writes the desktop and mobile screenshots of a finished run (docs/design/evidence/video-conn-test).
// What it does not prove: real go2rtc / ICE behaviour on a real phone (that is what the card is for).

const SHOTS = process.env.SW_SHOTS ?? '';
const ADDRESS = /\b\d{1,3}(?:\.\d{1,3}){3}\b|[0-9a-f]{1,4}:[0-9a-f]{1,4}:[0-9a-f:]*|\.local\b/i;
const FAKE_ADDRESSES = ['203.0.113.5', '203.0.113.50', '10.9.9.9', '198.51.100.7', '2001:db8', 'abcd-1234.local'];

type Scenario = 'ok' | 'ice' | 'nodecode' | 'hang' | 'cap';

const FAKE_MEDIA = () => {
  const w = window as unknown as Record<string, unknown>;
  w.__sockets = [] as { profile: string; closed: boolean; cameraId: string }[];
  w.__pcs = [] as { closed: boolean; profile: string }[];
  const scn = (profile: string) => ((w.__scn as Record<string, string>) ?? {})[profile] ?? 'ok';
  const RealWS = window.WebSocket;
  class FakeLive {
    url: string;
    readyState = 0;
    binaryType = 'blob';
    entry: { profile: string; closed: boolean; cameraId: string };
    onopen: ((e: Event) => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(url: string) {
      this.url = url;
      const u = new URL(url);
      this.entry = { profile: u.searchParams.get('profile') || 'sub', closed: false, cameraId: (/\/media\/live\/([^/]+)\/ws/.exec(u.pathname) ?? [])[1] ?? '' };
      (w.__sockets as unknown[]).push(this.entry);
      setTimeout(() => {
        if (this.readyState === 3) return;
        this.readyState = 1;
        this.onopen?.(new Event('open'));
        if (scn(this.entry.profile) === 'cap') {
          this.msg({ type: 'error', value: 'remote_live_cap', max: 2 });
          setTimeout(() => {
            this.readyState = 3;
            this.entry.closed = true;
            this.onclose?.({ code: 4429 } as CloseEvent);
          }, 30);
        }
      }, 20);
    }
    private msg(body: unknown, delay = 10) {
      setTimeout(() => this.readyState === 1 && this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(body) })), delay);
    }
    send(data: string) {
      const m = JSON.parse(data) as { type: string };
      if (m.type === 'webrtc/offer') {
        this.msg({ type: 'webrtc/answer', value: 'v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=candidate:1 1 udp 2130706431 10.9.9.9 8555 typ host\r\n' }, 30);
        this.msg({ type: 'webrtc/candidate', value: 'candidate:2 1 udp 1694498815 203.0.113.50 8555 typ srflx raddr 0.0.0.0 rport 8555' }, 60);
        this.msg({ type: 'webrtc/candidate', value: 'candidate:3 1 udp 1694498815 198.51.100.7 8555 typ srflx raddr 0.0.0.0 rport 8555' }, 70);
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
    iceGatheringState = 'new';
    iceConnectionState = 'new';
    connectionState = 'new';
    signalingState = 'stable';
    onicegatheringstatechange: (() => void) | null = null;
    oniceconnectionstatechange: (() => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    onsignalingstatechange: (() => void) | null = null;
    onicecandidate: ((e: { candidate: { candidate: string } | null }) => void) | null = null;
    onicecandidateerror: ((e: unknown) => void) | null = null;
    ontrack: ((e: { track: { kind: string } }) => void) | null = null;
    private timers: number[] = [];
    private bytes = 0;
    private frames = 0;
    private connected = false;
    private failed = false;
    private entry: { closed: boolean; profile: string };
    private mode: string;
    constructor() {
      const last = (w.__sockets as { profile: string }[]).slice(-1)[0];
      this.mode = scn(last?.profile ?? 'sub');
      this.entry = { closed: false, profile: last?.profile ?? 'sub' };
      (w.__pcs as unknown[]).push(this.entry);
    }
    addTransceiver() {}
    async createOffer() {
      return { type: 'offer', sdp: 'v=0 fake-offer' };
    }
    async addIceCandidate() {}
    private later(ms: number, fn: () => void) {
      this.timers.push(window.setTimeout(() => !this.entry.closed && fn(), ms));
    }
    private set(prop: 'iceGatheringState' | 'iceConnectionState' | 'connectionState' | 'signalingState', value: string, handler: (() => void) | null) {
      this[prop] = value;
      handler?.();
    }
    async setLocalDescription() {
      this.set('signalingState', 'have-local-offer', this.onsignalingstatechange);
      this.later(10, () => this.set('iceGatheringState', 'gathering', this.onicegatheringstatechange));
      for (const [i, line] of ['candidate:1 1 udp 2130706431 abcd-1234.local 50000 typ host', 'candidate:2 1 udp 2113937151 2001:db8::5 50000 typ host', 'candidate:3 1 udp 1694498815 203.0.113.5 50000 typ srflx raddr 0.0.0.0 rport 0'].entries()) this.later(20 + i * 10, () => this.onicecandidate?.({ candidate: { candidate: line } }));
      this.later(80, () => {
        this.onicecandidate?.({ candidate: null });
        this.set('iceGatheringState', 'complete', this.onicegatheringstatechange);
      });
    }
    async setRemoteDescription() {
      this.set('signalingState', 'stable', this.onsignalingstatechange);
      if (this.mode === 'hang') return this.later(30, () => this.set('iceConnectionState', 'checking', this.oniceconnectionstatechange));
      this.later(30, () => this.set('iceConnectionState', 'checking', this.oniceconnectionstatechange));
      if (this.mode === 'ice') {
        return this.later(400, () => {
          this.failed = true;
          this.set('iceConnectionState', 'failed', this.oniceconnectionstatechange);
          this.set('connectionState', 'failed', this.onconnectionstatechange);
        });
      }
      this.later(150, () => {
        this.connected = true;
        this.set('iceConnectionState', 'connected', this.oniceconnectionstatechange);
        this.set('connectionState', 'connected', this.onconnectionstatechange);
        this.ontrack?.({ track: { kind: 'video' } });
        this.timers.push(
          window.setInterval(() => {
            this.bytes += 6000;
            if (this.mode === 'ok') this.frames += 3;
          }, 100),
        );
      });
    }
    async getStats() {
      const pairState = this.connected ? 'succeeded' : this.failed ? 'failed' : 'in-progress';
      const rec: [string, Record<string, unknown>][] = [
        ['l1', { type: 'local-candidate', id: 'l1', candidateType: 'srflx', protocol: 'udp', address: '203.0.113.5', networkType: 'cellular' }],
        ['l2', { type: 'local-candidate', id: 'l2', candidateType: 'host', protocol: 'udp', address: 'abcd-1234.local', networkType: 'vpn' }],
        ['r1', { type: 'remote-candidate', id: 'r1', candidateType: 'srflx', protocol: 'udp', ip: '203.0.113.50' }],
        ['p1', { type: 'candidate-pair', id: 'p1', state: pairState, nominated: this.connected, localCandidateId: 'l1', remoteCandidateId: 'r1', currentRoundTripTime: 0.041, requestsSent: this.failed ? 7 : 5, responsesReceived: this.connected ? 5 : 0 }],
      ];
      if (this.connected) {
        rec.push(
          ['t', { type: 'transport', id: 't', selectedCandidatePairId: 'p1' }],
          ['c', { type: 'codec', id: 'c', mimeType: 'video/H264' }],
          ['v', { type: 'inbound-rtp', id: 'v', kind: 'video', codecId: 'c', bytesReceived: this.bytes, packetsReceived: this.bytes / 1200, packetsLost: 0, framesDecoded: this.frames, frameWidth: 1280, frameHeight: 720, pliCount: 1, nackCount: 0 }],
          ['a', { type: 'inbound-rtp', id: 'a', kind: 'audio', bytesReceived: this.bytes / 10 }],
        );
      }
      return new Map(rec);
    }
    close() {
      this.entry.closed = true;
      this.timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      this.connectionState = 'closed';
    }
  }
  (window as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = FakePC;
};

const ENCODING = { main: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 }, sub: { codec: 'H.264', webrtc: 'ok', gov_length: 50, fps: 25 } };

async function setup(page: Page, o: { scn: Record<string, Scenario>; configure?: boolean }) {
  await page.addInitScript((s) => ((window as unknown as Record<string, unknown>).__scn = s), o.scn);
  await page.addInitScript(FAKE_MEDIA);
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = o.configure === false ? ['video.live'] : ['video.live', 'system.configure'];
      return json({
        user: { id: 'u', username: 'owner', display_name: 'Owner', source: 'remote' },
        channel: 'remote',
        remote: { 'remote.policy': 'flag', 'remote.session': 'rolling_90d', 'remote.idle_lock_minutes': 720, 'remote.default_profile': 'main', 'remote.mse_fallback': 'true' },
        bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'cameras') {
      const cam = (id: string, channel: number, name: string) => ({ id, recorder_id: 'r', channel, name, name_source: 'nvr', alias: null, enabled: true, sort_order: channel, grid_col_span: 1, main_track: 1, sub_track: 2, status: 'online', last_seen_at: null, can_view_live: true, encoding: ENCODING });
      return json({ cameras: [cam('c2', 2, 'Street'), cam('c3', 3, 'Yard')], recorder: null, can_sync: false, media: {} });
    }
    if (p === 'settings') return json({ settings: { 'media.transport_default': 'auto', 'remote.max_live_streams': 16, 'remote.default_profile': 'main', 'remote.wall_profile': 'sub', 'remote.mse_fallback': 'true', 'remote.policy': 'flag', 'remote.session': 'rolling_90d' }, can_edit: o.configure !== false });
    if (p === 'health') return json({ version: 'test', status: 'ok' });
    if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-01T00:00:00Z', version: 'test' });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

const sockets = (page: Page) => page.evaluate(() => (window as unknown as { __sockets: { profile: string; closed: boolean; cameraId: string }[] }).__sockets.map((s) => ({ ...s })));
const pcs = (page: Page) => page.evaluate(() => (window as unknown as { __pcs: { profile: string; closed: boolean }[] }).__pcs.map((s) => ({ ...s })));

async function open(page: Page) {
  await page.goto('/?design=a#/system/diagnostics?tab=remote');
  await page.waitForSelector('system-diagnostics');
}
const card = (page: Page) => page.locator('system-video-conn-test');
const report = (page: Page) => card(page).locator('[data-conn-report]');
const run = async (page: Page) => {
  await expect(card(page).locator('[data-conn-camera] option')).toHaveCount(2, { timeout: 15000 });
  await card(page).locator('[data-conn-run]').click();
};
const finished = (page: Page) => expect(card(page).locator('[data-conn-run]')).toBeVisible({ timeout: 40000 });
const noAddresses = (text: string) => {
  expect(text).not.toMatch(ADDRESS);
  for (const a of FAKE_ADDRESSES) expect(text).not.toContain(a);
};

test.describe('video connection test (הגדרות › גישה מרחוק)', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name !== 'desktop', 'layout-independent logic; the screenshots set their own viewports');
  });

  test('connected and playing: verdict, report content, nothing left open, no address in the report', async ({ page }) => {
    await setup(page, { scn: { sub: 'ok', main: 'ok' } });
    await open(page);
    await run(page);
    await expect(card(page).locator('[data-conn-verdict="sub"]')).toContainText('מחובר ומנגן', { timeout: 20000 });
    await finished(page);
    const text = (await report(page).textContent()) ?? '';
    noAddresses(text);
    expect(text).toContain('channel: remote (Arx)');
    expect(text).toMatch(/browser: .+ \/ /);
    expect(text).toContain('local candidates: host 2, srflx 1, prflx 0, relay 0; ipv6: yes');
    expect(text).toContain('remote candidates (from go2rtc): 3');
    expect(text).toContain('srflx udp public');
    expect(text).toMatch(/\bice: connected/);
    expect(text).toMatch(/\bconn: connected/);
    expect(text).toContain('selected pair: srflx udp public (cellular) <-> srflx udp public');
    expect(text).toContain('local networks: cellular, vpn');
    expect(text).toMatch(/frames \d+\s+size 1280x720\s+pli 1/);
    expect(text).toContain('codec video/H264');
    expect(text).toMatch(/first frame: \d+ ms/);
    expect(text).toContain('verdict: מחובר ומנגן');
    // a single camera test = one socket and one peer connection, both closed
    expect(await sockets(page)).toEqual([{ profile: 'sub', closed: true, cameraId: 'c2' }]);
    expect(await pcs(page)).toEqual([{ profile: 'sub', closed: true }]);
    if (SHOTS) {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await card(page).scrollIntoViewIfNeeded();
      await card(page).screenshot({ path: `${SHOTS}/video-conn-test-desktop.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await card(page).scrollIntoViewIfNeeded();
      await card(page).screenshot({ path: `${SHOTS}/video-conn-test-mobile.png` });
    }
  });

  test('ICE failed: the verdict says UDP is blocked; the report shows the failed checks', async ({ page }) => {
    await setup(page, { scn: { sub: 'ice' } });
    await open(page);
    await run(page);
    await expect(card(page).locator('[data-conn-verdict="sub"]')).toContainText('ICE לא התחבר - כנראה UDP חסום ברשת הזו', { timeout: 20000 });
    await finished(page);
    const text = (await report(page).textContent()) ?? '';
    noAddresses(text);
    expect(text).toMatch(/ice: checking/);
    expect(text).toMatch(/ice: failed/);
    expect(text).toMatch(/conn: failed/);
    expect(text).toContain('STUN requests sent 7, answered 0');
    expect(text).toContain('first frame: none');
    expect(text).toContain('ended: ice_failed');
    expect((await sockets(page)).every((s) => s.closed)).toBe(true);
    expect((await pcs(page)).every((p) => p.closed)).toBe(true);
  });

  test('connected but no frames decode: the verdict names the codec (the run lasts the full 20 s)', async ({ page }) => {
    test.setTimeout(70_000);
    await setup(page, { scn: { sub: 'nodecode' } });
    await open(page);
    await run(page);
    await expect(card(page).locator('[data-conn-verdict="sub"]')).toContainText('מחובר אך אין פענוח - קודק', { timeout: 40000 });
    await finished(page);
    const text = (await report(page).textContent()) ?? '';
    noAddresses(text);
    expect(text).toContain('ended: timeout');
    expect(text).toMatch(/frames 0\s/);
    expect(text).toContain('first frame: none');
    expect(await sockets(page)).toEqual([{ profile: 'sub', closed: true, cameraId: 'c2' }]);
    expect((await pcs(page)).every((p) => p.closed)).toBe(true);
  });

  test('the relay refuses (remote live cap): shown as text, no peer connection, socket closed', async ({ page }) => {
    await setup(page, { scn: { sub: 'cap' } });
    await open(page);
    await run(page);
    await expect(card(page).locator('[data-conn-verdict="sub"]')).toContainText('הגעת למכסת הזרמים החיים בחיבור הזה (2) - הבדיקה לא רצה', { timeout: 10000 });
    await finished(page);
    const text = (await report(page).textContent()) ?? '';
    expect(text).toContain('refused: cap (max 2)');
    expect((await pcs(page)).every((p) => p.closed)).toBe(true); // the peer connection the player-like start opened is closed again
    expect((await sockets(page)).every((s) => s.closed)).toBe(true);
  });

  test('"העתק דוח" puts the same plain text on the clipboard: no addresses, no tokens, no cookies', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await context.addCookies([{ name: 'sw_session', value: 'SECRETCOOKIEVALUE0123456789abcdef', url: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' }]);
    await setup(page, { scn: { sub: 'ok' } });
    await open(page);
    await expect(card(page).locator('[data-conn-copy]')).toBeVisible({ timeout: 15000 });
    await expect(card(page).locator('[data-conn-copy] button')).toBeDisabled(); // nothing to copy before a run
    await run(page);
    await expect(card(page).locator('[data-conn-verdict="sub"]')).toContainText('מחובר ומנגן', { timeout: 20000 });
    await finished(page);
    await card(page).locator('[data-conn-copy]').click();
    await expect(card(page).locator('[data-conn-copied]')).toBeVisible();
    // the Windows clipboard turns the line breaks into CRLF
    const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
    expect(clip).toBe((await report(page).textContent()) ?? '');
    expect(clip.startsWith('SmplWise video connection test')).toBe(true);
    noAddresses(clip);
    expect(clip).not.toContain('SECRETCOOKIE');
    expect(clip).not.toMatch(/token|cookie|bearer/i);
  });

  test('"שניהם": sub then main in sequence, one report with both, every session closed', async ({ page }) => {
    await setup(page, { scn: { sub: 'ok', main: 'ice' } });
    await open(page);
    await expect(card(page).locator('[data-conn-camera] option')).toHaveCount(2, { timeout: 15000 });
    await card(page).locator('select[data-conn-profile]').selectOption('both');
    await card(page).locator('[data-conn-run]').click();
    await expect(card(page).locator('[data-conn-verdict="main"]')).toContainText('UDP חסום', { timeout: 30000 });
    await finished(page);
    await expect(card(page).locator('[data-conn-verdict="sub"]')).toContainText('מחובר ומנגן');
    const text = (await report(page).textContent()) ?? '';
    noAddresses(text);
    expect(text.match(/SmplWise video connection test/g)).toHaveLength(1);
    expect(text).toContain('=== camera channel 2 / sub ===');
    expect(text).toContain('=== camera channel 2 / main ===');
    expect((await sockets(page)).map((s) => s.profile)).toEqual(['sub', 'main']);
    expect((await sockets(page)).every((s) => s.closed)).toBe(true);
    expect((await pcs(page)).every((p) => p.closed)).toBe(true);
  });

  test('leaving the page mid-run closes the socket and the peer connection', async ({ page }) => {
    await setup(page, { scn: { sub: 'hang' } });
    await open(page);
    await run(page);
    await expect.poll(async () => (await pcs(page)).length).toBe(1);
    await expect(card(page).locator('[data-conn-stop]')).toBeVisible();
    expect((await sockets(page)).some((s) => !s.closed)).toBe(true);
    await page.evaluate(() => (location.hash = '#/live/cameras/none'));
    await expect(card(page)).toHaveCount(0);
    await expect.poll(async () => (await sockets(page)).every((s) => s.closed)).toBe(true);
    expect((await pcs(page)).every((p) => p.closed)).toBe(true);
  });

  test('"עצור" ends the run, keeps the report so far, and closes everything', async ({ page }) => {
    await setup(page, { scn: { sub: 'hang' } });
    await open(page);
    await run(page);
    await expect.poll(async () => (await pcs(page)).length).toBe(1);
    await expect(report(page)).toContainText('ice: checking', { timeout: 10000 });
    await card(page).locator('[data-conn-stop]').click();
    await finished(page);
    await expect(card(page).locator('[data-conn-verdict="sub"]')).toContainText('הבדיקה הופסקה');
    expect((await sockets(page)).every((s) => s.closed)).toBe(true);
    expect((await pcs(page)).every((p) => p.closed)).toBe(true);
  });

  test('only system.configure holders see the card', async ({ page }) => {
    await setup(page, { scn: {}, configure: false });
    await open(page);
    await expect(page.locator('[data-remote-settings]')).toBeVisible({ timeout: 15000 });
    await expect(card(page)).toHaveCount(0);
  });
});
