import { test, expect, request as pwRequest, type APIRequestContext, type Locator, type Page } from '@playwright/test';

// CR-020 S2 phase B evidence against the REAL backend whose NVR is the fake (smplwise_vms/backend/tests/fixtures/fake_devices.py,
// served by frontend/tests/fixtures/setup_fake_devices.py): the screen, the HTTP adapter, the routes, the guarded write path and
// the fake NVR's ISAPI document all run for real; only the device's HTTP answers are fake (`.test` hosts, nothing is contacted).
// Flows: SVC off through the ONE confirmation -> exactly ONE PUT reaches the fake NVR -> the list reads the new value -> the toast's
// undo -> a second PUT restores it; a busy NVR; an NVR that keeps the old value; a lost answer (never retried: one PUT);
// capability documents that answer 404 (the switch is disabled, nothing is sent).
//
//   SW_PORT=8349 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni <venv-python> frontend/tests/fixtures/setup_fake_devices.py
//   SW_LIVE=1 SW_CAMERAS_FIXTURE=1 SW_API_PORT=8349 SW_SETUP_CONTROL=http://127.0.0.1:8359 SW_BASE_URL=http://127.0.0.1:4189/ \
//     npx playwright test tests/evidence-nvr-cameras-fixture.spec.ts --workers=1
// Self-skips in every other run (the preview / gate runs have no fixture backend).
const CONTROL = process.env.SW_SETUP_CONTROL || 'http://127.0.0.1:8359';
const PAGE = 'sw-app system-security system-security-cameras';
const CONFIRM = 'sw-dialog[open][data-nvr-confirm-dialog]';

const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;
const rowOf = (page: Page, ch: number, ref: string): Locator =>
  page.locator(`${PAGE} ${phone(page) ? '[data-nvr-cards] [data-stream-card]' : '[data-nvr-table] tr[data-stream-row]'}[data-camera="nvr-1:${ch}"][data-stream="${ref}"]`);
const toggle = (page: Page) => rowOf(page, 1, '101').locator('sw-toggle[data-svc-toggle]');
const lineOf = (page: Page) => page.locator(`${PAGE} ${phone(page) ? '[data-nvr-cards]' : '[data-nvr-table]'} [data-nvr-line]`);

/** The lab-shaped main of channel 1: H.264 High, SVC on. */
const MAIN = { codec: 'H.264', profile: 'High', svc: true, width: 2560, height: 1440, bitrate_mode: 'VBR', bitrate_kbps: 3072, fps: 25, gop: 50, quality: 60 };

test.describe('CR-020 S2b cameras write against the fixture backend (fake NVR)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_CAMERAS_FIXTURE !== '1', 'set SW_LIVE=1 SW_CAMERAS_FIXTURE=1 against tests/fixtures/setup_fake_devices.py');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;

  async function nvrWrites(): Promise<string[]> {
    const r = await control.get('/writes');
    return ((await r.json()) as string[]).filter((w) => w.startsWith('nvr PUT /ISAPI/Streaming/channels/'));
  }

  test.beforeAll(async () => {
    control = await pwRequest.newContext({ baseURL: CONTROL });
  });

  test.beforeEach(async () => {
    expect((await control.post('/reset')).status()).toBe(200);
    expect((await control.post('/nvr', { data: { encodings_by_channel: { 1: { main: MAIN }, 4: { main: MAIN } } } })).status()).toBe(200);
  });

  /** The screen reads every camera's options on opening (the backend caches them per process: 10 minutes when readable, 60 s when not). */
  async function openPage(page: Page) {
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/security/cameras');
    await page.waitForSelector('sw-app');
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  }

  // FIRST: the capability documents of channel 4's main answer 404 BEFORE anything reads them (the backend caches a readable answer for 10
  // minutes, so this must be the first read of that stream in a fresh backend process): its switch is disabled, nothing is sent.
  test('capability documents answer 404: the switch is disabled with the reason in its tooltip, nothing is sent', async ({ page }) => {
    expect((await control.post('/nvr', { data: { caps_status_by_stream: { 401: { direct: 404, proxy: 404 } } } })).status()).toBe(200);
    await openPage(page);
    const tog = rowOf(page, 4, '401').locator('sw-toggle[data-svc-toggle]');
    await expect(tog).toBeVisible({ timeout: 30_000 });
    await expect(tog).toHaveAttribute('disabled', '');
    await expect(tog).toHaveAttribute('title', 'יכולות הזרם אינן ידועות');
    await tog.click({ force: true });
    await expect(page.locator(CONFIRM)).toHaveCount(0);
    expect(await nvrWrites()).toEqual([]);
    await expect(toggle(page)).not.toHaveAttribute('disabled'); // the other cameras are not affected
  });

  test.afterAll(async () => {
    await control?.post('/reset');
    await control?.dispose();
  });

  test('SVC off: one PUT reaches the NVR, the value is read back, the undo sends the second PUT that restores it', async ({ page }) => {
    await openPage(page);
    const tog = toggle(page);
    await expect(tog).toBeVisible({ timeout: 30_000 }); // after the camera's detail (options, writable) was read from the fake NVR
    await expect(tog).toHaveAttribute('checked', '');
    expect(await nvrWrites()).toEqual([]);
    await tog.click();
    await expect(page.locator(`${CONFIRM} [data-nvr-confirm]`)).toBeVisible();
    await expect(page.locator(CONFIRM)).toHaveAttribute('heading', 'לכבות SVC?');
    expect(await nvrWrites()).toEqual([]); // nothing was sent by the press
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(tog).not.toHaveAttribute('checked', '', { timeout: 30_000 });
    expect(await nvrWrites()).toEqual(['nvr PUT /ISAPI/Streaming/channels/101']);
    await expect(page.locator(`${PAGE} nvr-undo-toast [data-nvr-toast-text]`)).toHaveText('נשמר');
    // a fresh read of the list shows the NVR's own new value (the registry flips with it)
    await page.reload();
    await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await expect(rowOf(page, 1, '101').locator(phone(page) ? '.svcline' : 'td[data-col="svc"]')).toContainText(phone(page) ? 'SVC' : 'כבוי');
    await expect(toggle(page)).not.toHaveAttribute('checked', '', { timeout: 30_000 });
    // undo from the editor's history (the toast is gone after the reload): the press is the confirmation, a second PUT restores SVC
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    const hist = page.locator(`${PAGE} nvr-camera-editor [data-nvr-history]`);
    await expect(hist).toBeAttached({ timeout: 30_000 });
    await hist.locator('summary').click();
    await hist.locator('[data-nvr-undo-change]').click();
    await expect(page.locator(`${PAGE} nvr-undo-toast [data-nvr-toast-text]`)).toHaveText('השינוי בוטל', { timeout: 30_000 });
    expect(await nvrWrites()).toEqual(['nvr PUT /ISAPI/Streaming/channels/101', 'nvr PUT /ISAPI/Streaming/channels/101']);
    await expect(toggle(page)).toHaveAttribute('checked', '');
  });

  test('a busy NVR: one PUT, one line, the switch stays', async ({ page }) => {
    await openPage(page);
    expect((await control.post('/nvr', { data: { put: { status: 'busy' } } })).status()).toBe(200);
    await expect(toggle(page)).toBeVisible({ timeout: 30_000 });
    await toggle(page).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(lineOf(page).first()).toHaveText('ה־NVR עסוק. נסו שוב בעוד רגע.', { timeout: 30_000 });
    await expect(toggle(page)).toHaveAttribute('checked', '');
    await page.waitForTimeout(1500);
    expect(await nvrWrites()).toHaveLength(1);
  });

  test('the NVR answers OK and keeps the old value: "nvr_no_effect" line', async ({ page }) => {
    await openPage(page);
    expect((await control.post('/nvr', { data: { put: { status: 'ok', keeps_old: true } } })).status()).toBe(200);
    await expect(toggle(page)).toBeVisible({ timeout: 30_000 });
    await toggle(page).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(lineOf(page).first()).toHaveText('ה־NVR אישר את השינוי אבל לא שינה את ההגדרה.', { timeout: 30_000 });
    await expect(toggle(page)).toHaveAttribute('checked', '');
    expect(await nvrWrites()).toHaveLength(1);
  });

  test('the answer is lost after the PUT was applied: "הסטטוס נבדק", never retried (exactly one PUT)', async ({ page }) => {
    await openPage(page);
    expect((await control.post('/nvr', { data: { put: { status: 'timeout' }, timeout_applies: true } })).status()).toBe(200);
    await expect(toggle(page)).toBeVisible({ timeout: 30_000 });
    await toggle(page).click();
    await page.locator(`${CONFIRM} [data-nvr-confirm]`).click();
    await expect(lineOf(page).first()).toHaveText('הסטטוס נבדק', { timeout: 60_000 });
    await page.waitForTimeout(2000);
    expect(await nvrWrites()).toHaveLength(1);
  });
});
