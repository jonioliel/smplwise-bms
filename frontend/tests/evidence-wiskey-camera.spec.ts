import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';

// Evidence for the WisKey entry center's camera stills (T054, owner report 2026-09-28: "you can't see the cameras";
// owner rule the same day: all video goes through go2rtc). Every door card whose station has a camera shows a still of
// it, as WisKey's own overview does (`hikvision-intercom-camera .live=${false}`): the backend grabs one frame through
// go2rtc's /api/frame.jpeg from the station's own RTSP stream, with the shared WisKey account from the add-on options
// or a station's own override. A station without a camera keeps its door icon only; a still that cannot be had says
// why in words, never a broken image; the still is re-read on the live-wall poster cadence (60 s), driven here with
// Playwright's clock.
//
// Read-only towards WisKey: no WisKey command is sent. It runs against the committed fixture backend,
// tests/fixtures/wiskey_fake_ha.py (fake Home Assistant and fake go2rtc on `.test` hosts; the fake go2rtc answers a
// synthetic 64x36 JPEG only for the account each station accepts). How to start it is at the top of that file.
// Runs only with SW_LIVE=1 and SW_WISKEY_FIXTURE=1; one project (desktop).

const HASH = '#/wiskey/overview';
const CONTROL = process.env.SW_WISKEY_CONTROL || 'http://127.0.0.1:8357';
const FIXTURE_VERSION = '4.2.0-fake';
const POSTER_MS = 60_000; // live-wall.ts's poster cadence, reused by wiskey-overview.ts
const LOBBY_CREDS = '/api/v1/intercom/stations/lobby/credentials';

type Hit = { name: string; host: string; user: string; ok: boolean };

test.describe('WisKey entry center camera stills (through go2rtc)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_WISKEY_FIXTURE !== '1', 'set SW_LIVE=1 SW_WISKEY_FIXTURE=1 against the fixture backend');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }, testInfo) => {
    api = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL });
    const feed = await (await api.get('/api/v1/intercom/overview')).json();
    if (feed.state !== 'ready' || feed.overview?.version !== FIXTURE_VERSION) {
      throw new Error(`not the WisKey fixture backend (state ${feed.state}, version ${feed.overview?.version})`);
    }
    control = await pwRequest.newContext({ baseURL: CONTROL });
    expect((await control.post('/reset')).status()).toBe(200);
    await api.delete(LOBBY_CREDS);
  });

  test.afterAll(async () => {
    await api?.delete(LOBBY_CREDS);
    await control?.post('/reset');
    await control?.dispose();
    await api?.dispose();
  });

  async function open(page: Page) {
    await page.clock.install(); // real time keeps flowing; fastForward below jumps it
    await page.goto(`/?design=a${HASH}`);
    await page.waitForSelector('sw-app');
    await expect(page.locator('wiskey-overview [data-wiskey-door="gate"]')).toBeVisible({ timeout: 30000 });
  }

  const still = (page: Page, id: string) => page.locator(`wiskey-overview [data-wiskey-camera="${id}"]`);
  const srcOf = (page: Page, id: string) => still(page, id).locator('img').evaluate((el: HTMLImageElement) => el.src);
  const hits = async (): Promise<Hit[]> => (await (await control.get('/frame-hits')).json()) as Hit[];

  async function loaded(page: Page, id: string): Promise<{ src: string; width: number }> {
    const img = still(page, id).locator('img');
    await expect(img).toHaveCount(1);
    await expect.poll(async () => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), { timeout: 15000 }).toBe(64);
    return img.evaluate((el: HTMLImageElement) => ({ src: el.src, width: el.naturalWidth }));
  }

  test('a door with a camera shows its go2rtc still; without one the card keeps its icon; failures say so', async ({ page, request }, testInfo) => {
    await open(page);
    // gate: a real JPEG, loaded from the backend endpoint with a cache-buster, grabbed through go2rtc
    await expect(still(page, 'gate')).toHaveAttribute('data-camera-state', 'image');
    const gate = await loaded(page, 'gate');
    expect(new URL(gate.src).pathname).toBe('/api/v1/intercom/stations/gate/camera-snapshot.jpg');
    expect(new URL(gate.src).searchParams.get('t')).toMatch(/^\d+$/);
    await expect(still(page, 'gate').locator('.tag')).toHaveText('צילום');
    const gateHit = (await hits()).find((h) => h.name === 'smplwise_wiskey_gate');
    expect(gateHit).toEqual({ name: 'smplwise_wiskey_gate', host: '192.0.2.21', user: 'fixture-door', ok: true }); // the shared account
    const r = await request.get('/api/v1/intercom/stations/gate/camera-snapshot.jpg');
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toBe('image/jpeg');
    expect((await r.body()).subarray(0, 3).toString('hex')).toBe('ffd8ff');
    expect(r.headers()['cache-control']).toMatch(/^private, max-age=\d+$/);
    // office: no camera entity -> no still at all, the door icon stays
    const office = page.locator('wiskey-overview [data-wiskey-door="office"]');
    await expect(still(page, 'office')).toHaveCount(0);
    await expect(office.locator('.ic sw-icon')).toHaveAttribute('name', 'door');
    expect((await request.get('/api/v1/intercom/stations/office/camera-snapshot.jpg')).status()).toBe(404);
    // lobby: the station refuses the shared account (it needs its own) -> "no image" in words, no <img> left behind
    await expect(still(page, 'lobby')).toHaveAttribute('data-camera-state', 'unavailable', { timeout: 15000 });
    await expect(still(page, 'lobby').locator('img')).toHaveCount(0);
    await expect(still(page, 'lobby')).toContainText('אין תמונה מהמצלמה כרגע');
    const lobbyApi = await request.get('/api/v1/intercom/stations/lobby/camera-snapshot.jpg');
    expect(lobbyApi.status()).toBe(503);
    expect((await lobbyApi.json()).code).toBe('snapshot_unavailable');
    // store: offline -> said in words, nothing asked of go2rtc for it
    await expect(still(page, 'store')).toHaveAttribute('data-camera-state', 'offline');
    await expect(still(page, 'store')).toContainText('העמדה אינה מחוברת');
    expect((await hits()).some((h) => h.name === 'smplwise_wiskey_store')).toBe(false);
    await page.screenshot({ path: testInfo.outputPath('wiskey-camera-stills.png'), fullPage: true });
  });

  test('a station override is write-only; with it, and on the next 60 s refresh, the lobby still appears', async ({ page, request }, testInfo) => {
    await open(page);
    const first = await loaded(page, 'gate');
    await expect(still(page, 'lobby')).toHaveAttribute('data-camera-state', 'unavailable', { timeout: 15000 });

    // the administrator (the dev user joni is the bootstrap admin) sets lobby's own account; nobody else may
    expect((await request.put(LOBBY_CREDS, { data: { username: 'x', password: 'y' }, headers: { 'X-SW-Dev-User': 'stranger' } })).status()).toBe(403);
    const put = await request.put(LOBBY_CREDS, { data: { username: 'lobby-admin', password: 'lobby-pass' } });
    expect(put.status()).toBe(200);
    expect(await put.json()).toMatchObject({ station_id: 'lobby', override: true, effective: 'override', default_configured: true });
    const status = await (await request.get(LOBBY_CREDS)).text();
    expect(status).not.toContain('lobby-admin');
    expect(status).not.toContain('lobby-pass');

    // just short of the cadence: nothing changes
    await page.clock.fastForward(POSTER_MS - 5000);
    expect(await srcOf(page, 'gate')).toBe(first.src);
    await expect(still(page, 'lobby')).toHaveAttribute('data-camera-state', 'unavailable');

    // one tick: a new cache-buster for every still, and lobby is tried again - with its own account now
    await page.clock.fastForward(10_000);
    await expect.poll(() => srcOf(page, 'gate')).not.toBe(first.src);
    const second = await loaded(page, 'gate');
    expect(new URL(second.src).pathname).toBe(new URL(first.src).pathname);
    expect(Number(new URL(second.src).searchParams.get('t'))).toBeGreaterThanOrEqual(Number(new URL(first.src).searchParams.get('t')) + POSTER_MS);
    await expect(still(page, 'lobby')).toHaveAttribute('data-camera-state', 'image', { timeout: 15000 });
    await loaded(page, 'lobby');
    const lobbyHits = (await hits()).filter((h) => h.name === 'smplwise_wiskey_lobby');
    expect(lobbyHits.at(-1)).toEqual({ name: 'smplwise_wiskey_lobby', host: '192.0.2.22', user: 'lobby-admin', ok: true });
    expect(lobbyHits.some((h) => h.user === 'fixture-door' && !h.ok)).toBe(true); // before the override: refused

    // and again on the next tick
    await page.clock.fastForward(POSTER_MS);
    await expect.poll(() => srcOf(page, 'gate')).not.toBe(second.src);
    expect((await loaded(page, 'gate')).width).toBe(64);
    await page.screenshot({ path: testInfo.outputPath('wiskey-camera-stills-override.png'), fullPage: true });
  });
});
