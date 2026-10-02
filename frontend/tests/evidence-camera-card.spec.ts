import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The camera card of the area screens (owner 2026-09-30) against the REAL backend behind tests/fixtures/devices_fake_ha.py
 * (SW_DEVICES_FIXTURE=1): the real layout store, the real resolve / picker / still routes with their permission checks and the
 * real Home Assistant mapping - only Home Assistant's side is fake (its registry, and `camera_proxy` answering a generated
 * picture), and so is the browser's MEDIA STACK (a fake relay socket and a fake RTCPeerConnection, as the wall's live specs use):
 * what this proves is which cards ask for a stream, with which profile and transport, when they release it, and every state
 * the card shows. What it does NOT prove: real video through go2rtc (no NVR or go2rtc exists here) - that needs the lab.
 *
 *   SW_PORT=8348 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni <venv-python> frontend/tests/fixtures/devices_fake_ha.py
 *   (frontend/) npm run build; SW_LIVE=1 SW_DEVICES_FIXTURE=1 SW_API_PORT=8348 SW_BASE_URL=http://127.0.0.1:4823/ npx playwright test tests/evidence-camera-card.spec.ts --workers=1
 *
 * Screenshots (1440 / 390) go to docs/evidence/UIR1-camera-card/.
 */
const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR1-camera-card');
const EVIDENCE2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/UIR2-area');
const CONTROL = `http://127.0.0.1:${process.env.SW_FAKE_HA_CONTROL_PORT ?? String(Number(process.env.SW_API_PORT ?? '8099') + 1)}`;
const AREA = 'cc_hall';
const MODEL = 'DS-7616NXI-K2/D';
const E_MAIN = 'camera.ds_7616nxi_k2_d_hall_201'; // channel 2, main stream - an NVR channel exposed by the Hikvision integration
const E_SUB = 'camera.ds_7616nxi_k2_d_hall_202';
const E_GARDEN = 'camera.cc_garden'; // a standalone camera: a picture only

interface Sock {
  camera: string;
  profile: string;
  kind: string;
  closed: boolean;
}

const FAKE_MEDIA = () => {
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
      this.entry = { camera: (/\/media\/live\/([^/]+)\/ws/.exec(u.pathname) ?? [])[1] ?? '', profile: u.searchParams.get('profile') || 'sub', kind: '', closed: false };
      socks.push(this.entry);
      setTimeout(() => {
        if (this.entry.closed) return;
        this.readyState = 1;
        this.onopen?.(new Event('open'));
      }, 20);
    }
    send(data: string) {
      const msg = JSON.parse(data) as { type: string };
      const reply = (body: unknown) => setTimeout(() => this.readyState === 1 && this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(body) })), 20);
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
        let n = 0;
        this.timers.push(
          window.setInterval(() => {
            ctx.fillStyle = '#1e6b4f';
            ctx.fillRect(0, 0, 320, 180);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect((n * 12) % 300, 80, 20, 20);
            n++;
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

// a small real PNG for the snapshot route (the backend has no NVR to ask)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAABHM/ZoAAAAEklEQVR42mNgGAWjYBSMAlIAAAAAgAABcM9VUAAAAABJRU5ErkJggg==', 'base64');

const socks = (page: Page) => page.evaluate(() => (window as unknown as { __socks: Sock[] }).__socks.map((s) => ({ ...s })));
const active = async (page: Page) => (await socks(page)).filter((s) => !s.closed);

let cameraIds: Record<string, string> = {};

async function seed(request: APIRequestContext) {
  const rc = await request.post(`${CONTROL}/seed-cameras`, {
    data: {
      model: MODEL,
      cameras: [
        { channel: 1, alias: 'כניסה ראשית', status: 'online' },
        { channel: 2, alias: 'מסדרון', status: 'online' },
        { channel: 3, alias: 'חניה', status: 'online' },
        { channel: 4, alias: 'גג', status: 'offline' },
      ],
    },
  });
  expect(rc.status(), 'the fixture backend (tests/fixtures/devices_fake_ha.py) is required').toBe(200);
  cameraIds = ((await rc.json()) as { cameras: Record<string, string> }).cameras;
  const entities = [
    { entity_id: E_MAIN, id: 'reg-cc-main', platform: 'hikvision', device_id: 'dev-nvr', area_id: AREA, name: 'מסדרון (ראשי)' },
    { entity_id: E_SUB, id: 'reg-cc-sub', platform: 'hikvision', device_id: 'dev-nvr', area_id: AREA, name: 'מסדרון (משני)' },
    { entity_id: E_GARDEN, id: 'reg-cc-garden', platform: 'generic', device_id: 'dev-garden', area_id: AREA, name: 'מצלמת גינה' },
    { entity_id: 'light.cc_hall', id: 'reg-cc-light', platform: 'demo', device_id: null, area_id: AREA, name: 'תאורת אולם' },
  ];
  const areas = [{ area_id: AREA, name: 'אולם מצלמות', floor_id: 'cc_ground' }];
  const floors = [{ floor_id: 'cc_ground', name: 'קרקע', level: 0 }];
  // the dev registry seed only upserts: a camera an earlier spec file left on the shared fixture backend (e.g. the area
  // redesign's camera.ar2_cam) would be one more picker option, so disable the foreign cameras first (as HA's disabled_by)
  const foreign = ((await (await request.get('/api/v1/ha/entities?domain=camera&limit=2000')).json()).entities as { entity_id: string }[]).map((e) => e.entity_id).filter((id) => ![E_MAIN, E_SUB, E_GARDEN].includes(id));
  if (foreign.length) expect((await request.post('/api/v1/ha/dev/registry', { data: { entities: foreign.map((entity_id) => ({ entity_id, area_id: null, disabled_by: 'user' })), devices: [], areas, floors } })).status()).toBe(200);
  const reg = await request.post('/api/v1/ha/dev/registry', { data: { entities, devices: [], areas, floors } });
  expect(reg.status()).toBe(200);
  const st = await request.post('/api/v1/ha/dev/states', {
    data: {
      states: [
        { entity_id: E_MAIN, state: 'idle', attributes: { friendly_name: 'מסדרון (ראשי)' } },
        { entity_id: E_SUB, state: 'idle', attributes: { friendly_name: 'מסדרון (משני)' } },
        { entity_id: E_GARDEN, state: 'idle', attributes: { friendly_name: 'מצלמת גינה' } },
        { entity_id: 'light.cc_hall', state: 'on', attributes: { friendly_name: 'תאורת אולם', brightness: 200 } },
      ],
    },
  });
  expect(st.status()).toBe(200);
}

type Card = { key: string; y?: number; x?: number; w?: number; h?: number; title?: string; camera: unknown; profile?: string };

async function putLayout(request: APIRequestContext, cards: Card[]) {
  await request.delete(`/api/v1/devices/layouts/area/${AREA}?variant=all`);
  const items: Record<string, unknown> = {};
  for (const c of cards) items[c.key] = { x: c.x ?? 0, y: c.y ?? 0, w: c.w ?? 6, h: c.h ?? 34, text: 'md', bg: null, border: null, title: c.title ?? null, icon: null, hidden: false, hidden_entities: [], camera: c.camera, ...(c.profile ? { profile: c.profile } : {}) };
  const r = await request.put(`/api/v1/devices/layouts/area/${AREA}`, { data: { variant: 'desktop', revision: 0, layout: { v: 2, cols: 12, items } } });
  expect(r.status(), await r.text()).toBe(200);
}

const nvr = (channel: number) => ({ kind: 'nvr', recorder_id: 'nvr-1', channel });
const ha = (entity_id: string) => ({ kind: 'ha', entity_id });

const STANDARD: Card[] = [
  { key: 'camera:c1', x: 0, y: 0, title: 'כניסה', camera: nvr(1) },
  { key: 'camera:c2', x: 6, y: 0, camera: ha(E_MAIN) },
  { key: 'camera:c3', x: 0, y: 36, camera: ha(E_GARDEN) },
  { key: 'camera:c4', x: 6, y: 36, w: 3, h: 26, camera: nvr(4) },
  { key: 'camera:c5', x: 9, y: 36, w: 3, h: 26, camera: nvr(9) },
];

async function open(page: Page, hash = `/devices/areas/${AREA}`) {
  await page.addInitScript(FAKE_MEDIA);
  await page.route('**/api/v1/cameras/*/snapshot.jpg', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('devices-area devices-camera-card', { timeout: 30000 });
}

async function setSettings(request: APIRequestContext, body: Record<string, unknown>) {
  const r = await request.patch('/api/v1/settings', { data: body });
  expect(r.status(), await r.text()).toBe(200);
}

const card = (page: Page, key: string) => page.locator(`devices-area sw-card[data-camera-card="${key}"] devices-camera-card`);

test.describe('the camera card in an area screen (real backend, fake media stack)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(testInfo.project.name === 'tablet', 'desktop + phone');
  });
  test.afterAll(async ({ request }) => {
    await setSettings(request, { 'media.transport_default': 'mse', 'media.wall_profile': 'sub', 'media.max_live_sessions': 16 }).catch(() => undefined);
    await request.delete(`/api/v1/devices/layouts/area/${AREA}?variant=all`).catch(() => undefined);
  });

  test('every state of the card, side by side: live NVR channel, the same channel through its Home Assistant entity, a picture-only camera, an offline channel, a channel that is gone', async ({ page, request }, testInfo) => {
    test.setTimeout(90000);
    await seed(request);
    await setSettings(request, { 'media.transport_default': 'webrtc', 'media.wall_profile': 'sub', 'media.max_live_sessions': 16 });
    await putLayout(request, STANDARD);
    await open(page);
    // the NVR channel: a live player on the sub profile, over WebRTC (the installation's transport), titled by the layout
    await expect(card(page, 'camera:c1').locator('sw-camera-tile')).toHaveAttribute('cameraId', cameraIds['1'], { timeout: 20000 });
    await expect(card(page, 'camera:c1').locator('sw-live-player')).toHaveCount(1, { timeout: 20000 });
    await expect(card(page, 'camera:c1').locator('sw-camera-tile')).toHaveAttribute('name', 'כניסה');
    // the Home Assistant entity that is NVR channel 2 streams as that channel, named as the channel, main profile untouched
    await expect(card(page, 'camera:c2').locator('sw-camera-tile')).toHaveAttribute('cameraId', cameraIds['2']);
    await expect(card(page, 'camera:c2').locator('sw-camera-tile')).toHaveAttribute('name', 'מסדרון');
    await expect(card(page, 'camera:c2').locator('sw-live-player')).toHaveCount(1);
    await expect.poll(async () => (await active(page)).length, { timeout: 15000 }).toBe(2);
    const s = await socks(page);
    expect(s.map((x) => x.camera).sort()).toEqual([cameraIds['1'], cameraIds['2']].sort());
    expect(s.every((x) => x.profile === 'sub' && x.kind === 'webrtc'), 'the wall profile and the transport of the settings').toBe(true);
    // a camera that is not an NVR channel: a picture, honestly labelled, never a stream
    await expect(card(page, 'camera:c3').locator('[data-camera-badge]')).toHaveText('תמונה בלבד', { timeout: 20000 });
    await expect.poll(() => card(page, 'camera:c3').locator('img[data-camera-still]').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect(card(page, 'camera:c3').locator('sw-live-player')).toHaveCount(0);
    // an offline channel: the tile's own offline state, no stream
    await expect(card(page, 'camera:c4').locator('sw-camera-tile')).toHaveAttribute('state', 'offline');
    await expect(card(page, 'camera:c4').locator('sw-live-player')).toHaveCount(0);
    // a channel the catalogue no longer has
    await expect(card(page, 'camera:c5').locator('[data-camera-state="missing"]')).toContainText('המצלמה לא נמצאה');
    expect((await socks(page)).length, 'only the two live cards ever opened a stream').toBe(2);
    fs.mkdirSync(EVIDENCE, { recursive: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(EVIDENCE, `area-camera-cards-${testInfo.project.name === 'mobile' ? '390' : '1440'}.png`), fullPage: true });
  });

  test('the installation settings drive the card: MSE and the main wall profile, then back', async ({ page, request }) => {
    test.setTimeout(60000);
    await seed(request);
    await putLayout(request, STANDARD.slice(0, 2));
    await setSettings(request, { 'media.transport_default': 'mse', 'media.wall_profile': 'main' });
    await open(page);
    await expect.poll(async () => (await active(page)).length, { timeout: 20000 }).toBe(2);
    await expect.poll(async () => (await active(page)).every((x) => x.profile === 'main' && x.kind === 'mse'), { timeout: 10000 }).toBe(true);
    await setSettings(request, { 'media.transport_default': 'webrtc', 'media.wall_profile': 'sub' });
  });

  test('owner 2026-09-30, "איכות הזרם": each card has its own stream quality (auto | sub | main), chosen in the properties panel, stored in the layout, and it is the profile the relay is asked for', async ({ page, request }, testInfo) => {
    test.setTimeout(90000);
    await seed(request);
    await setSettings(request, { 'media.transport_default': 'mse', 'media.wall_profile': 'sub', 'media.max_live_sessions': 16 });
    // c1 main, c2 sub, c3 auto (no choice stored, as an older layout)
    await putLayout(request, [
      { key: 'camera:c1', x: 0, y: 0, title: 'כניסה', camera: nvr(1), profile: 'main' },
      { key: 'camera:c2', x: 6, y: 0, camera: nvr(2), profile: 'sub' },
      { key: 'camera:c3', x: 0, y: 36, camera: nvr(3) },
    ]);
    await open(page);
    await expect.poll(async () => (await active(page)).length, { timeout: 20000 }).toBe(3);
    const byCam = async () => Object.fromEntries((await active(page)).map((s) => [s.camera, `${s.profile}:${s.kind}`]));
    // the requested profile reaches the relay at any size; the transport is the installation's (MSE) for all three
    await expect.poll(byCam, { timeout: 10000 }).toEqual({ [cameraIds['1']]: 'main:mse', [cameraIds['2']]: 'sub:mse', [cameraIds['3']]: 'sub:mse' });
    await expect(card(page, 'camera:c1').locator('[data-camera-id]')).toHaveAttribute('data-quality', 'main');
    await expect(card(page, 'camera:c3').locator('[data-camera-id]')).toHaveAttribute('data-quality', 'auto');
    await expect(card(page, 'camera:c1').locator('[data-camera-quality-badge]')).toHaveCount(0); // nothing new outside edit mode
    // auto follows the wall's profile (main here); a card's own choice does not
    await setSettings(request, { 'media.wall_profile': 'main' });
    await page.reload();
    await expect.poll(async () => (await active(page)).length, { timeout: 20000 }).toBe(3);
    await expect.poll(byCam, { timeout: 10000 }).toEqual({ [cameraIds['1']]: 'main:mse', [cameraIds['2']]: 'sub:mse', [cameraIds['3']]: 'main:mse' });
    await setSettings(request, { 'media.wall_profile': 'sub' });
    test.skip(testInfo.project.name !== 'desktop', 'the properties panel is the desktop editor');
    // the editor: the panel offers the three choices for a camera card, the badge names the choice in edit mode only
    await page.reload();
    await page.locator('devices-area sw-card[data-camera-card="camera:c3"]').waitFor({ timeout: 30000 });
    await page.locator('sw-app').getByRole('button', { name: /תפריט המשתמש/ }).click();
    await page.locator('[data-menu-screen-edit="devices-layout"]').click();
    await expect(page.locator('devices-area [data-layout-bar]')).toBeVisible();
    await expect(card(page, 'camera:c1').locator('[data-camera-quality-badge]')).toHaveText('איכות: ראשי');
    await expect(card(page, 'camera:c3').locator('[data-camera-quality-badge]')).toHaveText('איכות: אוטומטי');
    await page.locator('devices-area .lay-item[data-lay-key="camera:c3"]').focus();
    const panel = page.locator('devices-area [data-layout-panel="camera:c3"]');
    await expect(panel.locator('[data-layout-quality]')).toHaveCount(3);
    await expect(panel.locator('[data-layout-quality="auto"]')).toHaveAttribute('aria-pressed', 'true');
    await panel.locator('[data-layout-quality="main"]').click();
    await expect(card(page, 'camera:c3').locator('[data-camera-quality-badge]')).toHaveText('איכות: ראשי');
    fs.mkdirSync(EVIDENCE2, { recursive: true });
    await page.screenshot({ path: path.join(EVIDENCE2, 'camera-quality-panel-1440.png') });
    await page.locator('devices-area sw-button[data-layout-save]').click();
    await expect(page.locator('devices-area [data-layout-bar]')).toHaveCount(0, { timeout: 15000 });
    const saved = (await (await request.get(`/api/v1/devices/layouts/area/${AREA}`)).json()).desktop.layout.items;
    expect([saved['camera:c1'].profile, saved['camera:c2'].profile, saved['camera:c3'].profile]).toEqual(['main', 'sub', 'main']);
    // and back to auto stores nothing
    await page.reload();
    await expect.poll(async () => (await active(page)).length, { timeout: 20000 }).toBe(3);
    await expect.poll(byCam, { timeout: 10000 }).toEqual({ [cameraIds['1']]: 'main:mse', [cameraIds['2']]: 'sub:mse', [cameraIds['3']]: 'main:mse' });
    await expect(card(page, 'camera:c3').locator('[data-camera-quality-badge]')).toHaveCount(0);
    await request.delete(`/api/v1/devices/layouts/area/${AREA}?variant=all`);
  });

  test('the live cap: two live cards under a cap of one - one streams, the other shows its snapshot', async ({ page, request }) => {
    test.setTimeout(60000);
    await seed(request);
    await putLayout(request, STANDARD.slice(0, 2));
    await setSettings(request, { 'media.transport_default': 'webrtc', 'media.max_live_sessions': 1 });
    await open(page);
    await expect.poll(async () => (await active(page)).length, { timeout: 20000 }).toBe(1);
    await expect(page.locator('devices-area sw-live-player')).toHaveCount(1);
    await expect(page.locator('devices-area [data-snapshot-label]')).toHaveText('תמונה · לחץ לצפייה חיה');
    await page.waitForTimeout(2500);
    expect((await socks(page)).length, 'one attempt only: the card that is over the budget never asks the relay').toBe(1);
    await setSettings(request, { 'media.max_live_sessions': 16 });
  });

  test('a card scrolled far off screen holds no stream; scrolling to it starts one and, after the grace, the first lets go; a hidden tab releases too', async ({ page, request }) => {
    test.setTimeout(90000);
    await seed(request);
    await setSettings(request, { 'media.transport_default': 'webrtc', 'media.max_live_sessions': 1 });
    // the offline channel five times between them (a phone stacks the cards in one column: the second card must still be far away);
    // an offline card never asks for a stream, so they hold no slot either
    const fillers = [0, 1, 2, 3, 4, 5].map((i) => ({ key: `camera:f${i}`, x: 0, y: 40 + i * 28, w: 6, h: 26, camera: nvr(4) }));
    await putLayout(request, [
      { key: 'camera:c1', x: 0, y: 0, w: 12, h: 34, camera: nvr(1) },
      ...fillers,
      { key: 'camera:c2', x: 0, y: 260, w: 12, h: 34, camera: ha(E_MAIN) }, // ~2100 px down
    ]);
    await open(page);
    await expect.poll(async () => (await active(page)).map((x) => x.camera), { timeout: 20000 }).toEqual([cameraIds['1']]);
    await page.waitForTimeout(1500);
    expect((await socks(page)).length, 'the far card never asked').toBe(1);
    await card(page, 'camera:c2').scrollIntoViewIfNeeded();
    // the cap is one: the first card keeps its slot until it has been out of view for RELEASE_MS (5 s), then the second gets it
    await expect.poll(async () => (await active(page)).map((x) => x.camera), { timeout: 20000 }).toEqual([cameraIds['2']]);
    const all = await socks(page);
    expect(all.filter((x) => x.camera === cameraIds['1']).every((x) => x.closed)).toBe(true);
    // a hidden tab: the stream is released after the grace (visibilitychange with document.hidden true)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await active(page)).length, { timeout: 15000 }).toBe(0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await active(page)).length, { timeout: 15000 }).toBe(1);
    await setSettings(request, { 'media.max_live_sessions': 16 });
  });

  test('a press opens the single-camera view; the enlarge button plays the main stream in its own view and the card lets go meanwhile', async ({ page, request }) => {
    test.setTimeout(60000);
    await seed(request);
    await setSettings(request, { 'media.transport_default': 'webrtc', 'media.wall_profile': 'sub', 'media.max_live_sessions': 16 });
    await putLayout(request, STANDARD.slice(0, 1));
    await open(page);
    await expect.poll(async () => (await active(page)).length, { timeout: 20000 }).toBe(1);
    // the enlarge button (hover on a desktop, always visible on a touch screen)
    await card(page, 'camera:c1').hover();
    await card(page, 'camera:c1').locator('[data-camera-expand]').click();
    const big = page.locator('[data-camera-big]');
    await expect(big).toHaveCount(1);
    await expect(big.locator('sw-live-player')).toHaveCount(1);
    await expect.poll(async () => (await active(page)).map((x) => x.profile), { timeout: 15000 }).toEqual(['main']);
    await page.screenshot({ path: path.join(EVIDENCE, `expanded-${page.viewportSize()!.width}.png`) });
    await big.locator('[data-camera-big-close]').click();
    await expect(big).toHaveCount(0);
    await expect.poll(async () => (await active(page)).map((x) => x.profile), { timeout: 15000 }).toEqual(['sub']);
    // a press on the card opens the single-camera view of the catalogue camera
    await card(page, 'camera:c1').locator('[data-camera-hit]').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe(`#/live/cameras/${cameraIds['1']}`);
  });

  test('loading, a failed resolve with a retry, and the picker: only the cameras this user may watch', async ({ page, request, playwright }, testInfo) => {
    test.setTimeout(90000);
    await seed(request);
    await setSettings(request, { 'media.transport_default': 'webrtc', 'media.max_live_sessions': 16 });
    await putLayout(request, STANDARD.slice(0, 2));
    // the first resolve of the first card is slow, of the second card fails once
    let failed = false;
    await page.route('**/api/v1/devices/camera-card/resolve**', async (route) => {
      const url = route.request().url();
      if (url.includes(`channel=1`)) {
        await new Promise((r) => setTimeout(r, 1800));
        return route.continue();
      }
      if (!failed) {
        failed = true;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'boom', user_message: 'שגיאת שרת', retryable: true, correlation_id: '', details: {} }) });
      }
      return route.continue();
    });
    await open(page);
    await expect(card(page, 'camera:c1').locator('[data-camera-state="loading"]')).toBeVisible({ timeout: 10000 });
    await expect(card(page, 'camera:c2').locator('[data-camera-state="error"]')).toBeVisible({ timeout: 10000 });
    fs.mkdirSync(EVIDENCE, { recursive: true });
    await page.screenshot({ path: path.join(EVIDENCE, `loading-and-error-${page.viewportSize()!.width}.png`) });
    await card(page, 'camera:c2').locator('[data-camera-retry]').click();
    await expect(card(page, 'camera:c2').locator('sw-camera-tile')).toHaveAttribute('cameraId', cameraIds['2'], { timeout: 15000 });
    await expect(card(page, 'camera:c1').locator('sw-camera-tile')).toHaveAttribute('cameraId', cameraIds['1'], { timeout: 15000 });

    // the picker: the administrator sees every channel, grouped by recorder, and the picture-only camera apart
    await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'pick-host';
      host.style.cssText = 'position:fixed;inset-block-start:60px;inset-inline-start:16px;inline-size:min(360px,92vw);z-index:9999;background:var(--sw-surface);padding:12px;border:1px solid var(--sw-border);border-radius:12px';
      host.innerHTML = '<devices-camera-picker></devices-camera-picker>';
      document.body.append(host);
      (window as unknown as { __picked: unknown[] }).__picked = [];
      host.addEventListener('camera-picked', (e) => (window as unknown as { __picked: unknown[] }).__picked.push((e as CustomEvent).detail));
    });
    const picker = page.locator('#pick-host devices-camera-picker');
    await expect(picker.locator('[data-camera-group="nvr-1"] button.opt')).toHaveCount(4, { timeout: 15000 });
    await expect(picker.locator('[data-camera-group="more"] button.opt')).toHaveCount(1);
    await expect(picker.locator('[data-camera-option="ha:camera.cc_garden"]')).toContainText('תמונה בלבד');
    await expect(picker.locator(`[data-camera-option="ha:${E_MAIN}"]`)).toHaveCount(0); // an NVR channel is listed once, as the channel
    await page.screenshot({ path: path.join(EVIDENCE, `picker-${page.viewportSize()!.width}.png`) });
    await picker.locator('[data-camera-option="nvr:nvr-1:3"]').click();
    expect(await page.evaluate(() => (window as unknown as { __picked: unknown[] }).__picked)).toEqual([{ source: nvr(3), name: 'חניה' }]);

    // a user without video.live on channel 2 (an explicit deny on that camera): the picker does not offer it, the card is a clear state
    const vera = `vera-${testInfo.project.name}`;
    const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': vera } })).json();
    for (const body of [
      { subject_kind: 'user', subject_id: me.user.id, role_id: 'viewer', scope_type: 'installation', scope_id: '*' },
      { subject_kind: 'user', subject_id: me.user.id, role_id: 'viewer', scope_type: 'camera', scope_id: cameraIds['2'], effect: 'deny' },
    ]) expect([200, 201, 409], 'a binding of an earlier run is fine').toContain((await request.post('/api/v1/access/bindings', { data: body })).status());
    const asVera = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL, extraHTTPHeaders: { 'X-SW-Dev-User': vera } });
    const list = (await (await asVera.get('/api/v1/devices/camera-card/sources')).json()) as { recorders: { cameras: { channel: number }[] }[]; ha_cameras: { entity_id: string }[] };
    expect(list.recorders[0].cameras.map((c) => c.channel)).toEqual([1, 3, 4]);
    expect(list.ha_cameras.map((h) => h.entity_id)).toEqual([E_GARDEN]);
    expect(list.ha_cameras.some((h) => h.entity_id === E_MAIN || h.entity_id === E_SUB), 'the denied channel is not offered through its Home Assistant entities either').toBe(false);
    const denied = await (await asVera.get(`/api/v1/devices/camera-card/resolve?kind=nvr&recorder_id=nvr-1&channel=2`)).json();
    expect(denied).toEqual({ state: 'forbidden' });
    await asVera.dispose();
    const page2 = await page.context().newPage();
    await page2.setExtraHTTPHeaders({ 'X-SW-Dev-User': vera });
    await open(page2);
    await expect(card(page2, 'camera:c2').locator('[data-camera-state="forbidden"]')).toContainText('אין הרשאת צפייה במצלמה הזו', { timeout: 20000 });
    await expect(card(page2, 'camera:c1').locator('sw-live-player')).toHaveCount(1, { timeout: 20000 });
    expect((await socks(page2)).map((x) => x.camera), 'the denied card never asked the relay').toEqual([cameraIds['1']]);
    await page2.screenshot({ path: path.join(EVIDENCE, `forbidden-${page2.viewportSize()!.width}.png`) });
    await page2.close();
  });

  test('the picture-only camera is refreshed by the server at most every 10 s (one call to Home Assistant for two looks)', async ({ request }) => {
    await seed(request);
    const before = ((await (await request.get(`${CONTROL}/camera-proxy`)).json()) as { calls: Record<string, number> }).calls[E_GARDEN] ?? 0;
    for (let i = 0; i < 3; i++) {
      const r = await request.get(`/api/v1/devices/camera-card/still?entity_id=${E_GARDEN}`);
      expect(r.status()).toBe(200);
      expect(r.headers()['content-type']).toBe('image/jpeg');
    }
    const after = ((await (await request.get(`${CONTROL}/camera-proxy`)).json()) as { calls: Record<string, number> }).calls[E_GARDEN] ?? 0;
    expect(after - before, 'three looks inside the window: at most one call to the camera').toBeLessThanOrEqual(1);
    // an NVR channel is never served through the picture route
    expect((await request.get(`/api/v1/devices/camera-card/still?entity_id=${E_MAIN}`)).status()).toBe(409);
  });
});
