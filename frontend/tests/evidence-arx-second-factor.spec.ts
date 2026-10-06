import { test, expect, type Page } from '@playwright/test';
import crypto from 'node:crypto';

// K11 (the optional TOTP second factor), end to end against tests/fixtures/arx_fake_ha.py (the real backend with the remote
// channel ON at /arx/, a fake Home Assistant core). Run like evidence-arx-remote.spec.ts: SW_LIVE=1 SW_ARX_FIXTURE=1
// SW_API_PORT=<port>. Desktop only. It proves, with the real backend: a user turns the factor on in החשבון שלי (QR / key,
// first code), the next sign-in (a fresh browser) shows HA's password step and then OUR code step, a wrong code is refused
// and keeps the step, a right code signs in, the same code cannot be used twice, and an administrator's reset from the
// remote channel (audited) lets the user in without a code. What it does not prove: a real authenticator app scanning the QR
// (the secret is read from the key shown beside it and the code computed here with RFC 6238).

const ENABLED = process.env.SW_ARX_FIXTURE === '1';
const PORT = process.env.SW_API_PORT || '8349';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const FAKE = `http://127.0.0.1:${process.env.SW_FAKE_HA_PORT || String(Number(PORT) + 2)}`;
const ARX = `${ORIGIN}/arx/`;

test.skip(!ENABLED, 'needs the Arx fixture backend (SW_ARX_FIXTURE=1, tests/fixtures/arx_fake_ha.py)');
test.describe.configure({ mode: 'serial' });
test.use({ serviceWorkers: 'block' });

function base32(text: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of text.replace(/[\s=]/g, '').toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 SHA-1, 6 digits, 30 s steps; `offset` steps from now. */
function totp(secret: Buffer, offset = 0): string {
  const counter = Math.floor(Date.now() / 30_000) + offset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac('sha1', secret).update(msg).digest();
  const o = mac[mac.length - 1] & 0x0f;
  const value = (mac.readUInt32BE(o) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

async function device(browser: import('@playwright/test').Browser) {
  const run = 1 + Math.floor(Math.random() * 250);
  const context = await browser.newContext({ serviceWorkers: 'block', locale: 'he-IL', timezoneId: 'Asia/Jerusalem', viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'CF-Connecting-IP': `198.19.${run}.${1 + Math.floor(Math.random() * 250)}` } });
  const page = await context.newPage();
  await page.route(`${ORIGIN}/auth/**`, async (route) => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${FAKE}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  return { context, page };
}

async function credentials(page: Page, username: string, password: string) {
  await page.goto(ARX);
  const login = page.locator('arx-login');
  await expect(login).toBeVisible();
  await login.locator('#username').fill(username);
  await login.locator('#password').fill(password);
  await login.locator('[data-arx-submit]').click();
}

test('enrol, sign in with the code, no replay, administrator reset', async ({ browser }) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop only');
  const errors: string[] = [];

  // 1. dana signs in (no factor yet) and turns it on in החשבון שלי
  const first = await device(browser);
  first.page.on('pageerror', (e) => errors.push(e.message));
  await credentials(first.page, 'dana', 'pw-dana');
  await expect(first.page.locator('sw-app')).toBeVisible();
  await first.page.locator('sw-app [data-profile-menu]').click();
  const menu = first.page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
  await menu.locator('[data-menu-account]').click();
  await menu.locator('[data-my-second-factor] summary').click();
  const section = menu.locator('[data-my-second-factor] sw-second-factor');
  await expect(section.locator('[data-sf-state]')).toHaveText('כבוי');
  await section.locator('[data-sf-enable]').click();
  await expect(section.locator('svg[data-sf-qr]')).toBeVisible();
  const secret = base32((await section.locator('[data-sf-key]').innerText()) ?? '');
  expect(secret.length).toBe(20);
  const confirmCode = totp(secret);
  await section.locator('[data-sf-code]').fill(confirmCode);
  await section.locator('[data-sf-confirm]').click();
  await expect(section.locator('[data-sf-state]')).toContainText('פעיל');
  await first.page.screenshot({ path: test.info().outputPath('k11-enrolled.png') });

  // 2. a fresh browser: HA's password step, then OUR code step
  const second = await device(browser);
  second.page.on('pageerror', (e) => errors.push(e.message));
  await credentials(second.page, 'dana', 'pw-dana');
  const login = second.page.locator('arx-login');
  await expect(login.locator('h1')).toHaveText('אימות דו־שלבי');
  await expect(login.locator('#code')).toBeVisible();
  await expect(second.page.locator('sw-app')).toHaveCount(0);
  await second.page.screenshot({ path: test.info().outputPath('k11-login-code-step.png') });
  // a wrong code is refused and the step stays
  await login.locator('#code').fill('000000');
  await login.locator('[data-arx-verify]').click();
  await expect(login.locator('[data-arx-error]')).toContainText('קוד האימות אינו נכון');
  await expect(login.locator('#code')).toBeVisible();
  // the confirm code of step 1 is spent (same 30 s step): replay refused; the next step's code is accepted
  await login.locator('#code').fill(confirmCode);
  await login.locator('[data-arx-verify]').click();
  await expect(login.locator('[data-arx-error]')).toBeVisible();
  await login.locator('#code').fill(totp(secret, 1));
  await login.locator('[data-arx-verify]').click();
  await expect(second.page.locator('sw-app')).toBeVisible();
  await expect(second.page.locator('arx-login')).toHaveCount(0);
  expect((await second.page.request.get(`${ARX}api/v1/me`)).status()).toBe(200);

  // 3. the administrator resets dana's factor from the remote channel; it is audited
  const adminDev = await device(browser);
  adminDev.page.on('pageerror', (e) => errors.push(e.message));
  await credentials(adminDev.page, 'joni', 'pw-joni');
  await expect(adminDev.page.locator('sw-app')).toBeVisible();
  const reset = await adminDev.page.evaluate(async () => {
    const r = await fetch('api/v1/auth/second-factor/users/u-viewer', { method: 'DELETE' });
    return { status: r.status, body: await r.json() };
  });
  expect(reset).toEqual({ status: 200, body: { user_id: 'u-viewer', removed: true } });
  const audit = await adminDev.page.evaluate(async () => (await fetch('api/v1/audit?prefix=auth.second_factor&limit=20')).json());
  expect(JSON.stringify(audit)).toContain('auth.second_factor.reset');

  // 4. dana signs in again without a code
  const third = await device(browser);
  await credentials(third.page, 'dana', 'pw-dana');
  await expect(third.page.locator('sw-app')).toBeVisible();
  await expect(third.page.locator('arx-login')).toHaveCount(0);

  expect(errors).toEqual([]);
  for (const d of [first, second, adminDev, third]) await d.context.close();
});
