import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { GOOD, installMfaMock, openPolicyTab, openSecurity } from './mfa-screens-mocks';

// FIX-PHONEKEY-2570 (second deep review 2.57, SA2-01): a phone key can now be ADDED - החשבון שלי › אבטחה › מפתחות טלפון, inside the
// Android app - against a MOCKED backend (tests/mfa-screens-mocks.ts) and a FAKE Android bridge (mobile/android-shell BridgeScript.kt
// `ArxApp.deviceKey`: create / sign / setKeyId / signedPrompt). Invented ids only. NOT a real phone: the Keystore, the fingerprint
// prompt and the attestation are the owner's acceptance steps (docs/changes/FIX-PHONEKEY-2570.md).
//   1. in the app: label, add -> challenge {purpose: register} -> the app creates and signs -> POST auth/device-keys -> the app keeps the
//      id; the list marks "this phone", the add is no longer offered, and the approval watcher starts looking without a reload;
//   2. a user with another factor: the server's 403 step_up_required -> the shell's dialog -> the registration is sent once more, once;
//   3. the prompt cancelled on the phone: nothing is registered, the screen says so;
//   4. an older app: "update the app to 2.1.0", no add; a browser: where a key is added, and the "approve on the phone" switch is
//      replaced by the same honest line (kept while it is on, so it can be switched off).
//   SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/evidence-fix-phonekey-2570.spec.ts --project=desktop --project=mobile --workers=2
// SW_SHOTS_DIR=<dir> also writes the compare-page pictures (light + dark).

const skipTablet = () => test.skip(test.info().project.name === 'tablet', 'desktop + phone');

interface FakeApp {
  signedPrompt?: boolean;
  create?: boolean;
  /** the app's reason for a refused prompt (`cancelled`), or none */
  signFails?: string;
  hasKey?: string | null;
}

/** The Android app's bridge, faked: one key per server, the id kept by setKeyId; records every call in `window.__dk`. */
async function fakeApp(page: Page, o: FakeApp = {}) {
  await page.addInitScript((opt: FakeApp) => {
    const w = window as unknown as Record<string, unknown>;
    const log: { create: unknown[]; sign: [string, string | undefined][]; setKeyId: string[] } = { create: [], sign: [], setKeyId: [] };
    w.__dk = log;
    const st = { exists: !!opt.hasKey, keyId: opt.hasKey ?? null };
    const deviceKey: Record<string, unknown> = {
      status: () => Promise.resolve({ available: true, exists: st.exists, keyId: st.keyId, authKind: 'biometric_or_screen_lock' }),
      sign: (payload: string, text?: string) => {
        log.sign.push([payload, text]);
        return opt.signFails ? Promise.reject(new Error(opt.signFails)) : Promise.resolve({ signature: 'MEUCIQ' + 'A'.repeat(60) });
      },
    };
    if (opt.create !== false) {
      deviceKey.create = (x: unknown) => {
        log.create.push(x);
        st.exists = true;
        st.keyId = null;
        return Promise.resolve({ publicKey: 'MFkw' + 'B'.repeat(80), authKind: 'biometric_or_screen_lock', attestation: ['Y2VydDE=', 'Y2VydDI='] });
      };
      deviceKey.setKeyId = (k: string) => {
        log.setKeyId.push(k);
        st.keyId = k;
        return Promise.resolve({});
      };
    }
    if (opt.signedPrompt !== false) deviceKey.signedPrompt = true;
    w.ArxApp = Object.freeze({ platform: 'android', shell: 'webview', version: opt.signedPrompt === false ? '2.0.2' : '2.1.0', switchServer() {}, deviceKey: Object.freeze(deviceKey) });
  }, o);
}

const dkLog = (page: Page) => page.evaluate(() => (window as unknown as { __dk: { create: { authKind: string; payload: string }[]; sign: [string, string | undefined][]; setKeyId: string[] } }).__dk);

test('in the app: a phone key is added on this phone; the list marks it; the approval watcher starts without a reload', async ({ page }) => {
  skipTablet();
  const mock = await installMfaMock(page);
  await fakeApp(page);
  const { sec } = await openSecurity(page);
  const keys = sec.locator('sw-device-keys');
  await expect(keys.locator('[data-device-key]')).toHaveCount(2);
  await expect(keys.locator('[data-device-key-add]')).toBeVisible();
  expect(mock.approvalLooks).toBe(0); // no key in the app yet: the phone never asks for approvals
  // the watcher starts 3 s after the page (main.ts) and finds no key; from here only the enrolment itself can start it
  await page.waitForFunction(() => performance.now() > 4500, null, { timeout: 15000 });
  expect(mock.approvalLooks).toBe(0);
  await keys.locator('[data-device-key-label]').fill('Galaxy של המנהל');
  await keys.locator('[data-device-key-add-button]').click();
  await expect(keys.locator('[data-device-keys-message]')).toContainText('מפתח הטלפון נוסף');
  await expect(keys.locator('[data-device-key]')).toHaveCount(3);
  const mine = keys.locator('[data-device-key="dk_000000000000000000000001"]');
  await expect(mine).toContainText('Galaxy של המנהל');
  await expect(mine.locator('[data-device-key-this]')).toBeVisible();
  await expect(keys.locator('[data-device-key-add]')).toHaveCount(0);
  await expect(keys.locator('[data-device-key-this-has]')).toBeVisible();
  // the wire: one register challenge, one registration with what the app made; the app keeps the server's id
  expect(mock.calls.filter((c) => c.path === 'auth/device-keys/challenge').map((c) => c.body)).toEqual([{ purpose: 'register' }]);
  expect(mock.registers).toEqual([{ challenge_id: 'dkn_register_mock', public_key: 'MFkw' + 'B'.repeat(80), signature: 'MEUCIQ' + 'A'.repeat(60), label: 'Galaxy של המנהל',
    auth_kind: 'biometric_or_screen_lock', attestation: ['Y2VydDE=', 'Y2VydDI='] }]);
  const log = await dkLog(page);
  expect(log.create).toHaveLength(1);
  expect(log.create[0].payload).toMatch(/^arx-device-key\|v1\|register\|/);
  expect(log.sign).toEqual([[log.create[0].payload, 'רישום מפתח הטלפון לחשבון']]); // SA2-02: the signed purpose's words
  expect(log.setKeyId).toEqual(['dk_000000000000000000000001']);
  // SA2-01 improvement: the watcher (shell/push-approval-watch.ts) read the key id again after the enrolment
  await expect.poll(() => mock.approvalLooks, { timeout: 10000 }).toBeGreaterThan(0);
  // the overview counts the new key
  await expect(sec.locator('[data-sec-line="device-keys"]')).toContainText('3');
});

test('in the app: a user with another factor confirms first; the registration is sent once more, once', async ({ page }) => {
  skipTablet();
  const mock = await installMfaMock(page, { registerNeedsProof: true });
  await fakeApp(page);
  const { sec } = await openSecurity(page);
  const keys = sec.locator('sw-device-keys');
  await keys.locator('[data-device-key-add-button]').click();
  const dialog = page.locator('sw-step-up-dialog');
  await expect(dialog.locator('[data-step-up-cancel]')).toBeVisible();
  await dialog.locator('[data-step-up-code]').fill(GOOD);
  await dialog.locator('[data-step-up-confirm]').click();
  await expect(keys.locator('[data-device-keys-message]')).toContainText('מפתח הטלפון נוסף');
  expect(mock.calls.filter((c) => c.method === 'POST' && c.path === 'auth/device-keys')).toHaveLength(2); // refused once, sent once more
  expect(mock.registers).toHaveLength(1);
  expect(mock.verifies.map((v) => [v.code, v.action])).toEqual([[GOOD, 'auth.device_key.register']]);
});

test('in the app: the prompt cancelled on the phone registers nothing and says so', async ({ page }) => {
  skipTablet();
  const mock = await installMfaMock(page);
  await fakeApp(page, { signFails: 'cancelled' });
  const { sec } = await openSecurity(page);
  const keys = sec.locator('sw-device-keys');
  await keys.locator('[data-device-key-add-button]').click();
  await expect(keys.locator('[data-device-keys-error]')).toContainText('הרישום בוטל בטלפון');
  expect(mock.registers).toEqual([]);
  expect((await dkLog(page)).setKeyId).toEqual([]);
  await expect(keys.locator('[data-device-key]')).toHaveCount(2);
  // the phone now holds an unconfirmed key: adding again replaces it (said before the press)
  await expect(keys.locator('[data-device-key-replaces]')).toBeVisible();
});

test('an older app is asked to update; nothing is offered to register', async ({ page }) => {
  skipTablet();
  const mock = await installMfaMock(page, { deviceKeys: [] });
  await fakeApp(page, { signedPrompt: false });
  const { sec } = await openSecurity(page);
  const keys = sec.locator('sw-device-keys');
  await expect(keys.locator('[data-device-keys-update]')).toContainText('2.1.0');
  await expect(keys.locator('[data-device-key-add]')).toHaveCount(0);
  expect(mock.calls.filter((c) => c.path === 'auth/device-keys/challenge')).toHaveLength(0);
});

test('a browser: where a key is added; the "approve on the phone" switch gives way to the same honest line', async ({ page }) => {
  skipTablet();
  await installMfaMock(page, { deviceKeys: [] });
  const { sec } = await openSecurity(page);
  const keys = sec.locator('sw-device-keys');
  await expect(keys.locator('[data-device-keys-no-app]')).toContainText('Android');
  await expect(keys.locator('[data-device-keys-no-app]')).toContainText('2.1.0');
  await expect(keys.locator('[data-device-key-add]')).toHaveCount(0);
  const tab = await openPolicyTab(page);
  await expect(tab.locator('[data-fp-push-unavailable]')).toContainText('2.1.0');
  await expect(tab.locator('[data-fp-push]')).toHaveCount(0);
});

test('the switch stays where it can be used: inside the app, and anywhere while it is on', async ({ page }) => {
  skipTablet();
  await installMfaMock(page, { settings: { 'security.push_approval': 'on', 'security.step_up': 'on' } });
  const tab = await openPolicyTab(page);
  await expect(tab.locator('[data-fp-push]')).toHaveCount(1); // on: it must stay possible to switch it off from a browser
  await expect(tab.locator('[data-fp-push-unavailable]')).toHaveCount(0);
});

test('inside the app the "approve on the phone" switch is offered', async ({ page }) => {
  skipTablet();
  await installMfaMock(page);
  await fakeApp(page);
  const tab = await openPolicyTab(page);
  await expect(tab.locator('[data-fp-push]')).toHaveCount(1);
  await expect(tab.locator('[data-fp-push-unavailable]')).toHaveCount(0);
});

// ---------------------------------------------------------------- compare-page pictures (SW_SHOTS_DIR only; before and after builds)

const SHOTS = process.env.SW_SHOTS_DIR || '';
test('shots: the phone keys block in the app and in a browser, light and dark', async ({ page, browser, baseURL }) => {
  skipTablet();
  test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
  test.setTimeout(180_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const size = page.viewportSize() ?? { width: 1440, height: 900 };
  const phone = size.width <= 860;
  for (const where of ['app', 'browser'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      const ctx = await browser.newContext({ baseURL, viewport: size, isMobile: phone, hasTouch: phone, colorScheme: scheme, locale: 'he-IL', reducedMotion: 'reduce' });
      const p = await ctx.newPage();
      await installMfaMock(p, where === 'browser' ? { deviceKeys: [] } : {});
      if (where === 'app') await fakeApp(p);
      await openSecurity(p);
      const block = p.locator('sw-app sw-user-menu [data-my-security] sw-account-security [data-sec-block="device-keys"]');
      await block.scrollIntoViewIfNeeded().catch(() => undefined);
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(SHOTS, `${where}-${phone ? 'phone' : 'desktop'}-${scheme}.png`) });
      await ctx.close();
    }
  }
});
