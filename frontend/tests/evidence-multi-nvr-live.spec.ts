import { test, expect, type Page } from '@playwright/test';

// CR-024 against the REAL backend with two fake recorders: tests/fixtures/multi_nvr_backend.py (the first recorder from the development
// NVR_* values, the second stored in Arx; the fake NVRs and go2rtc of smplwise_vms/backend/tests/fixtures/fake_devices.py - nothing here
// can reach a real device). One journey per project on the same backend (read-only except a rename that is put back).
//   SW_PORT=8391 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni <venv-python> frontend/tests/fixtures/multi_nvr_backend.py
//   SW_LIVE=1 SW_MULTINVR=1 SW_API_PORT=8391 SW_BASE_URL=http://127.0.0.1:<vite>/ npx playwright test tests/evidence-multi-nvr-live.spec.ts
const CARD = 'sw-app system-setup nvr-recorders-card';
const TABLE = 'sw-app system-security system-security-cameras';

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

test.describe('multi-NVR against the fixture backend (two fake recorders)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_MULTINVR !== '1', 'set SW_LIVE=1 SW_MULTINVR=1 against tests/fixtures/multi_nvr_backend.py');
  test.describe.configure({ mode: 'serial' });

  test('the recorders, their cameras, the filters and the event log come from the real API', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // both recorders are listed by the real /recorders, online after the start-up discovery
    await expect.poll(async () => (await page.request.get('/api/v1/recorders')).json().then((j) => j.recorders.map((r: { id: string; status: { state: string } }) => `${r.id}:${r.status.state}`).sort().join(',')),
      { timeout: 30_000 }).toBe('nvr-1:online,nvr-2:online');
    await open(page, '/system/setup');
    await expect(page.locator(`${CARD} [data-recorder]`)).toHaveCount(2);
    await expect(page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-name]`)).toHaveText('NVR מחסן');
    await expect(page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-cameras]`)).toContainText('4');
    await page.locator(`${CARD} [data-recorder="nvr-2"] [data-recorder-connection]`).click();
    await expect(page.locator(`${CARD} [data-recorder="nvr-2"] nvr-connection-form [data-conn-summary]`)).toContainText('fake-nvr-2.test');
    const html = await page.locator(CARD).evaluate((el) => el.shadowRoot!.innerHTML);
    expect(html).not.toContain('fixture-pass-two');
    // the camera list: eight cameras, both recorders named; the same name on both is told apart by the recorder
    const cams = await (await page.request.get('/api/v1/cameras')).json();
    expect(cams.cameras.length).toBe(8);
    expect(cams.recorders.map((r: { id: string }) => r.id)).toEqual(['nvr-1', 'nvr-2']);
    expect(new Set(cams.cameras.filter((c: { channel: number }) => c.channel === 1).map((c: { name: string }) => c.name)).size).toBe(2);
    // the camera settings table and its recorder filter
    await open(page, '/system/security/cameras');
    await expect(page.locator(`${TABLE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await expect(page.locator(`${TABLE} select[data-nvr-filter="recorder"]`)).toBeVisible();
    await page.locator(`${TABLE} select[data-nvr-filter="recorder"]`).selectOption('nvr-2');
    const wide = (page.viewportSize()?.width ?? 1440) >= 900;
    const rows = page.locator(`${TABLE} ${wide ? '[data-nvr-table] tr[data-stream-row]' : '[data-nvr-cards] [data-stream-card]'}`);
    await expect.poll(() => rows.evaluateAll((els) => els.length > 0 && els.every((e) => (e.getAttribute('data-camera') ?? '').startsWith('nvr-2:')))).toBe(true);
    // the wall's recorder filter
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sw.wall.count', '16');
        localStorage.removeItem('sw.wall.recorder');
      } catch {
        /* about:blank */
      }
    });
    await open(page, '/live/wall');
    await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(8, { timeout: 20_000 });
    await page.locator('live-wall select[data-wall-recorder]').selectOption('nvr-1');
    await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(4);
    // the event log asks the server for one recorder
    await open(page, '/investigate/events');
    const asked = page.waitForRequest((r) => r.url().includes('/api/v1/events?') && r.url().includes('recorder_id=nvr-2'));
    await page.locator('investigate-events select[data-filter-recorder]').selectOption('nvr-2');
    expect((await (await asked).response())?.status()).toBe(200);
    expect(errors).toEqual([]);
  });
});
