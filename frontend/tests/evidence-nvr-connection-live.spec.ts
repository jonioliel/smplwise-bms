import { test, expect, request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-022 slice C against the REAL backend with fake recorders: tests/fixtures/nvr_connection_backend.py (the backend started without
// an NVR, the fake NVR of smplwise_vms/backend/tests/fixtures/fake_devices.py answering the reserved name fake-nvr.test; nothing
// here can reach a real device). One serial journey on a FRESH backend per project (the installation keeps what the first test
// saved): the wizard asks for a choice, the vendor catalogue is the server's, the test makes GET requests only, an unreachable /
// refusing NVR gets its one-line answers, the save sets the restart-required flag (which survives a reload), outside the
// platform the banner says to restart by hand, nothing ever shows the password back, and "הסר NVR" ends in "ללא NVR".
//
//   SW_PORT=8373 SW_DATA_DIR=<empty dir> SW_DEV_USER=joni SW_BOOTSTRAP_ADMIN=joni <venv-python> frontend/tests/fixtures/nvr_connection_backend.py
//   SW_LIVE=1 SW_NVRCONN=1 SW_API_PORT=8373 SW_NVRCONN_CONTROL=http://127.0.0.1:8383 SW_BASE_URL=http://127.0.0.1:4193/ \
//     npx playwright test tests/evidence-nvr-connection-live.spec.ts --project=desktop --workers=1
// (start a new backend, new data dir and ports, before each project). SW_SHOTS=1 writes screenshots to docs/design/evidence/nn4.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/nn4');
const CONTROL = process.env.SW_NVRCONN_CONTROL || 'http://127.0.0.1:8383';
// a canary the fake NVR "accepts" (the fake does not check credentials) and no response or page may ever carry back
const CANARY = 'canary-live-pass-5520';
const HOST = 'fake-nvr.test';

const WIZ = 'system-wizard section[data-step="nvr"]';
const BANNER = 'sw-app nvr-restart-banner [data-restart-banner]';

async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `live-${name}-${test.info().project.name}.png`) });
}

async function open(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
}

test.describe('NVR connection against the fixture backend (fake NVR)', () => {
  test.skip(process.env.SW_LIVE !== '1' || process.env.SW_NVRCONN !== '1', 'set SW_LIVE=1 SW_NVRCONN=1 against tests/fixtures/nvr_connection_backend.py');
  test.describe.configure({ mode: 'serial' });

  let control: APIRequestContext;
  const bodies: string[] = [];

  test.beforeAll(async () => {
    control = await pwRequest.newContext({ baseURL: CONTROL });
  });
  test.afterAll(async () => {
    await control?.post('/nvr', { data: { up: true, auth: true } });
    await control?.dispose();
  });
  test.beforeEach(async ({ page }) => {
    page.on('response', async (r) => {
      if (!r.url().includes('/api/v1/')) return;
      try {
        bodies.push(await r.text());
      } catch {
        /* a body that is gone (navigation) cannot carry anything */
      }
    });
  });

  test('a fresh installation: the wizard asks for a choice, the catalogue is the server\'s, nothing is chosen for the installer', async ({ page, request }) => {
    const me = await (await request.get('/api/v1/me')).json();
    expect(me.mode, 'the fixture backend must start without an NVR').toBe('ha_only');
    expect(me.connection_pending_restart).toBe(false);
    const cat = await (await request.get('/api/v1/nvr/vendors')).json();
    expect(cat.vendors.map((v: { id: string; status: string }) => `${v.id}:${v.status}`)).toEqual(['hikvision:available', 'provision_isr:planned', 'frigate:planned', 'none:available']);
    await open(page, '/system/wizard');
    const step = page.locator(WIZ);
    await expect(step).toHaveAttribute('data-status', 'todo', { timeout: 30000 });
    await expect(step.locator('[data-conn-vendor] option')).toHaveText(['בחרו סוג NVR', 'Hikvision', 'Provision-ISR · בקרוב', 'Frigate · בקרוב', 'ללא NVR']);
    expect((await (await request.get('/api/v1/nvr/connection')).json()).state).toBe('not_chosen');
    await expect(page.locator(BANNER)).toHaveCount(0);
    await shot(page, 'wizard-todo');
  });

  test('the test is GET only: an unreachable NVR and refused credentials get one short line, then it connects', async ({ page }) => {
    await open(page, '/system/wizard');
    const step = page.locator(WIZ);
    await expect(step.locator('[data-conn-vendor]')).toBeVisible({ timeout: 30000 });
    await step.locator('[data-conn-vendor]').selectOption('hikvision');
    await step.locator('[data-conn-field="host"]').fill(HOST);
    await step.locator('[data-conn-field="username"]').fill('viewer');
    await step.locator('[data-conn-field="password"]').fill(CANARY);
    expect((await control.post('/nvr', { data: { up: false } })).status()).toBe(200);
    await step.locator('[data-conn-test]').click();
    await expect(step.locator('[data-conn-test-result]')).toHaveText('לא ניתן להתחבר', { timeout: 30000 });
    await expect(step.locator('[data-conn-save-anyway]')).toBeVisible();
    await shot(page, 'wizard-unreachable');
    expect((await control.post('/nvr', { data: { up: true, auth: false } })).status()).toBe(200);
    await step.locator('[data-conn-test]').click();
    await expect(step.locator('[data-conn-test-result]')).toHaveText('שם משתמש או סיסמה שגויים', { timeout: 30000 });
    await expect(step.locator('[data-conn-save-anyway]')).toHaveCount(0);
    expect((await control.post('/nvr', { data: { up: true, auth: true } })).status()).toBe(200);
    await step.locator('[data-conn-test]').click();
    await expect(step.locator('[data-conn-test-result]')).toHaveText(/^מחובר · .+ · \d+ ערוצים$/, { timeout: 30000 });
    await shot(page, 'wizard-connected');
    const writes = await (await control.get('/writes')).json();
    expect(writes, 'the connection test must never write to the NVR').toEqual([]);
    expect((await (await page.request.get('/api/v1/nvr/connection')).json()).state, 'a test saves nothing').toBe('not_chosen');
  });

  test('save: the restart-required flag survives a reload, outside the platform the banner says to restart by hand, the password is never shown back', async ({ page, request }) => {
    await open(page, '/system/wizard');
    const step = page.locator(WIZ);
    await expect(step.locator('[data-conn-vendor]')).toBeVisible({ timeout: 30000 });
    await step.locator('[data-conn-vendor]').selectOption('hikvision');
    await step.locator('[data-conn-field="host"]').fill(HOST);
    await step.locator('[data-conn-field="username"]').fill('viewer');
    await step.locator('[data-conn-field="password"]').fill(CANARY);
    await step.locator('[data-conn-save]').click();
    await expect(step.locator('[data-conn-msg]')).toContainText('החיבור נבדק ונשמר', { timeout: 30000 });
    await expect(step.locator('[data-conn-field="password"]')).toHaveValue('');
    await expect(page.locator(BANNER)).toBeVisible({ timeout: 10000 });
    const me = await (await request.get('/api/v1/me')).json();
    expect(me.connection_pending_restart).toBe(true);
    const view = await (await request.get('/api/v1/nvr/connection')).json();
    expect(view).toMatchObject({ vendor: 'hikvision', host: HOST, has_password: true, state: 'ok', pending_restart: true, restart: 'manual' });
    expect(JSON.stringify(view)).not.toContain(CANARY);
    // the stored connection waits for the restart: the step says so, it does not claim anything is unreadable
    await expect(step).toHaveAttribute('data-status', 'todo');
    await expect(step.locator('[data-step-problem]')).toHaveAttribute('data-step-problem', 'restart_pending');
    await shot(page, 'wizard-saved-pending');
    await page.reload();
    await expect(page.locator(BANNER)).toBeVisible({ timeout: 30000 });
    await expect(page.locator('sw-app nvr-restart-banner [data-restart-text]')).toHaveText('יש להפעיל מחדש את השירות כדי להחיל את השינוי');
    await expect(page.locator('sw-app nvr-restart-banner [data-restart-open]')).toHaveCount(0);
    await shot(page, 'banner-manual');
    // the restart route outside the platform: one answer, nothing restarted
    const r = await request.post('/api/v1/system/restart', { data: { confirm: true } });
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toBe('restart_manual');
    const writes = await (await control.get('/writes')).json();
    expect(writes.filter((w: string) => /deviceInfo|System\//.test(w))).toEqual([]);
  });

  test('settings: the summary shows the connection without the password; "שנה" opens an empty field; removing the NVR ends in "ללא NVR"', async ({ page, request }) => {
    await open(page, '/system/setup');
    const form = page.locator('system-setup nvr-connection-form');
    await expect(form.locator('[data-conn-summary]')).toContainText(HOST, { timeout: 30000 });
    await expect(form.locator('[data-conn-summary]')).toContainText('הוגדרה סיסמה');
    await expect(form.locator('[data-conn-summary]')).toContainText('Hikvision');
    await shot(page, 'settings-summary');
    await form.locator('[data-conn-edit]').click();
    await expect(form.locator('[data-conn-password-set]')).toBeVisible();
    await form.locator('[data-conn-password-change]').click();
    await expect(form.locator('[data-conn-field="password"]')).toHaveValue('');
    await shot(page, 'settings-edit');
    await form.locator('[data-conn-cancel]').click();
    // remove: the typed word gates the button
    await form.locator('[data-conn-remove]').first().click();
    const dlg = form.locator('[data-conn-remove-dialog]');
    await expect(dlg.locator('[data-conn-remove-confirm]')).toBeDisabled();
    await dlg.locator('[data-conn-remove-word]').fill('הסר');
    await dlg.locator('[data-conn-remove-confirm]').click();
    await expect(form.locator('[data-conn-msg]')).toHaveText('ה־NVR הוסר', { timeout: 30000 });
    await expect(form.locator('[data-conn-summary]')).toContainText('ללא NVR');
    const view = await (await request.get('/api/v1/nvr/connection')).json();
    expect(view).toMatchObject({ vendor: 'none', has_password: false, host: null, state: 'ok' });
    await shot(page, 'settings-removed');
    // the wizard now counts the explicit "no NVR" as done
    await open(page, '/system/wizard');
    await expect(page.locator(WIZ)).toHaveAttribute('data-status', 'done', { timeout: 30000 });
    await expect(page.locator(`${WIZ} [data-step-status]`)).toHaveText('ללא NVR');
    await shot(page, 'wizard-no-nvr');
  });

  test('the password is nowhere: no API answer and no page of this journey ever carried it', async () => {
    expect(bodies.length).toBeGreaterThan(5);
    expect(bodies.filter((b) => b.includes(CANARY))).toEqual([]);
  });
});
