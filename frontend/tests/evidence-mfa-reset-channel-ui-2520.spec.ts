import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installMfaMock, openPolicyTab } from './mfa-screens-mocks';

// MFA-RESET-CHANNEL-UI-2520, against the MOCKED backend of tests/mfa-screens-mocks.ts (invented users):
//   1. review N-7: Settings › Users & permissions › Second factor shows `security.factor_reset_channel` (any | local, default any) as a
//      row of the sign-in policy card - saved with the tab's one save row, disabled for a non-system-administrator, and while `local` is
//      stored the way back to "anywhere" is disabled outside the local network (the server's rules, shown);
//   2. the step-up dialog: a user whose passkey counts (the server lists it) in a browser without passkeys is told why the passkey is
//      not offered; with passkeys the wording stays "a passkey or the code".
//   SW_BASE_URL=http://localhost:4173/ npx playwright test tests/evidence-mfa-reset-channel-ui-2520.spec.ts --project=desktop --project=mobile --workers=2
// SW_SHOT_DIR=<dir> (+ SW_SCHEME=light|dark) also writes the compare-page pictures.

const skipTablet = () => test.skip(test.info().project.name === 'tablet', 'desktop + phone');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
// the mock's /me (tests/mfa-screens-mocks.ts), for the variations below
const PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign', 'identity.directory.read'];
const ME = { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true,
  bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
  permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
  bootstrap_state: 'done', mode: 'full' };

async function shot(loc: Locator | Page, name: string) {
  const dir = process.env.SW_SHOT_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await loc.screenshot({ path: path.join(dir, `${name}-${test.info().project.name}-${process.env.SW_SCHEME ?? 'light'}.png`), animations: 'disabled' });
}

async function scheme(page: Page) {
  const dark = process.env.SW_SCHEME === 'dark';
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
  // the app's scheme is the browser's own choice, else the installation's `ui.scheme` (light) - not the OS (design/apply.ts)
  await page.addInitScript((value) => localStorage.setItem('sw.ui.scheme', value), dark ? 'dark' : 'light');
}

/** Replace the mock's /me (routes added later win): another channel or other bindings. */
async function me(page: Page, over: Record<string, unknown>) {
  await page.route('**/api/v1/me', (route) => json(route, { ...ME, ...over }));
}

// ---------------------------------------------------------------- N-7: the reset channel row

test('the reset channel shows "anywhere" by default and saves "local network only" alone', async ({ page }) => {
  skipTablet();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await installMfaMock(page);
  await scheme(page);
  const tab = await openPolicyTab(page);
  await shot(tab.locator('[data-fp-policy-card]'), 'reset-channel-row'); // before the row's checks: the base build makes the "before" picture
  const row = tab.locator('[data-fp-policy-card] [data-fp-row="reset-channel"]');
  await expect(row).toBeVisible();
  await expect(row).toContainText('איפוס דרכי אימות של משתמשים');
  await expect(row).toContainText('החזרה ל״מכל מקום״ רק מהרשת המקומית');
  const seg = row.locator('sw-segmented[data-fp-reset-channel]');
  await expect(seg).toHaveAttribute('value', 'any');
  await expect(seg).not.toHaveAttribute('disabled', '');
  await seg.locator('[data-fp-reset-channel-option="local"]').click();
  await tab.locator('[data-fp-save]').click();
  await expect(tab.locator('[data-fp-message]')).toBeVisible();
  expect(mock.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ 'security.factor_reset_channel': 'local' }]);
  await expect(seg).toHaveAttribute('value', 'local');
  expect(errors).toEqual([]);
});

test('from outside, with "local network only" stored, the way back to "anywhere" is closed and says why', async ({ page }) => {
  skipTablet();
  await installMfaMock(page, { settings: { 'security.factor_reset_channel': 'local' } });
  await scheme(page);
  await me(page, { channel: 'remote' });
  const tab = await openPolicyTab(page);
  const row = tab.locator('[data-fp-row="reset-channel"]');
  await expect(row.locator('sw-segmented')).toHaveAttribute('value', 'local');
  await expect(row.locator('[data-fp-reset-channel-option="any"]')).toBeDisabled();
  await expect(row.locator('[data-fp-reset-channel-option="local"]')).toBeEnabled();
  await expect(row.locator('[data-fp-reset-channel-why]')).toContainText('אפשרית רק מהרשת המקומית');
  await shot(tab.locator('[data-fp-policy-card]'), 'reset-channel-remote');
});

test('on the local network the way back to "anywhere" is open', async ({ page }) => {
  skipTablet();
  const mock = await installMfaMock(page, { settings: { 'security.factor_reset_channel': 'local' } });
  const tab = await openPolicyTab(page);
  const row = tab.locator('[data-fp-row="reset-channel"]');
  await row.locator('[data-fp-reset-channel-option="any"]').click();
  await tab.locator('[data-fp-save]').click();
  await expect(tab.locator('[data-fp-message]')).toBeVisible();
  expect(mock.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ 'security.factor_reset_channel': 'any' }]);
});

test('a holder of system.configure who is not a system administrator sees the row read-only, with the reason', async ({ page }) => {
  skipTablet();
  await installMfaMock(page);
  await me(page, { bindings: [{ ...ME.bindings[0], role_id: 'site_admin', role_name: 'מנהל אתר' }] });
  const tab = await openPolicyTab(page);
  const row = tab.locator('[data-fp-row="reset-channel"]');
  await expect(row.locator('sw-segmented')).toHaveAttribute('disabled', '');
  await expect(row.locator('[data-fp-reset-channel-why]')).toContainText('רק מנהל מערכת');
  await expect(tab.locator('sw-toggle[data-fp-passkey]')).not.toHaveAttribute('disabled', ''); // the other keys stay editable
});

test('read-only for a holder of rbac.assign alone', async ({ page }) => {
  skipTablet();
  await installMfaMock(page, { reader: true });
  const tab = await openPolicyTab(page);
  await expect(tab.locator('[data-fp-row="reset-channel"] sw-segmented')).toHaveAttribute('disabled', '');
  await expect(tab.locator('[data-fp-row="reset-channel"] [data-fp-reset-channel-why]')).toHaveCount(0); // the tab's own read-only line says it
});

test('English: the row speaks the reader\'s language', async ({ page }) => {
  skipTablet();
  await installMfaMock(page);
  await page.route('**/api/v1/me/prefs', (route) => json(route, { prefs: { 'ui.lang': 'en' }, stored: ['ui.lang'], updated_at: null }));
  await page.addInitScript(() => localStorage.setItem('sw.ui.lang', 'en'));
  const tab = await openPolicyTab(page);
  const row = tab.locator('[data-fp-row="reset-channel"]');
  await expect(row).toContainText("Resetting users' sign-in methods");
  await expect(row.locator('[data-fp-reset-channel-option="any"]')).toContainText('Anywhere');
  await expect(row.locator('[data-fp-reset-channel-option="local"]')).toContainText('Local network only');
});

// ---------------------------------------------------------------- the step-up dialog wording

/** The preview runs at an IP address (not a secure context): WebAuthn is absent there. These tests only need the dialog to SEE a browser
 * with passkeys (`passkeysSupported`); no ceremony reaches the device (the wrong-address check stops before it). */
async function passkeyBrowser(page: Page) {
  await page.addInitScript(() => {
    if (typeof window.PublicKeyCredential !== 'function') Object.defineProperty(window, 'PublicKeyCredential', { value: function PublicKeyCredential() {}, configurable: true });
    if (!navigator.credentials?.create) {
      const refuse = () => Promise.reject(new DOMException('not allowed', 'NotAllowedError'));
      Object.defineProperty(navigator, 'credentials', { value: { create: refuse, get: refuse }, configurable: true });
    }
  });
}

test('step-up dialog: a passkey that counts and passkeys in this browser - "a passkey or the code"', async ({ page }) => {
  skipTablet();
  await passkeyBrowser(page);
  await installMfaMock(page, { methods: ['totp', 'passkey'], settings: { 'security.step_up': 'on' } });
  await scheme(page);
  const tab = await openPolicyTab(page);
  await tab.locator('sw-toggle[data-fp-wall]').click();
  await tab.locator('[data-fp-save]').click();
  const dlg = page.locator('sw-step-up-dialog');
  await expect(dlg.locator('[data-step-up-text]')).toContainText('אשר במפתח גישה או הזן את הקוד');
  await expect(dlg.locator('[data-step-up-passkey]')).toBeVisible();
  await expect(dlg.locator('[data-step-up-passkey-elsewhere]')).toHaveCount(0);
  await shot(page, 'step-up-both'); // the whole page: the dialog lives in the top layer
});

test('step-up dialog: a passkey that counts but no passkeys in this browser - the code, and why the passkey is not offered', async ({ page }) => {
  skipTablet();
  await page.addInitScript(() => {
    // a browser without WebAuthn (an old web view)
    Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true });
  });
  await installMfaMock(page, { methods: ['totp', 'passkey'], settings: { 'security.step_up': 'on' } });
  await scheme(page);
  const tab = await openPolicyTab(page);
  await tab.locator('sw-toggle[data-fp-wall]').click();
  await tab.locator('[data-fp-save]').click();
  const dlg = page.locator('sw-step-up-dialog');
  await expect(dlg.locator('[data-step-up-text]')).toContainText('הזן את הקוד הנוכחי');
  await expect(dlg.locator('[data-step-up-code]')).toBeVisible();
  await shot(page, 'step-up-passkey-elsewhere'); // before the row's own checks: the base build makes the "before" picture
  await expect(dlg.locator('[data-step-up-passkey]')).toHaveCount(0);
  await expect(dlg.locator('[data-step-up-passkey-elsewhere]')).toContainText('למפתח הגישה שלך צריך דפדפן שתומך במפתחות גישה');
});

test('step-up dialog: at another address than the passkey\'s, the passkey button says where it works', async ({ page }) => {
  skipTablet();
  await passkeyBrowser(page);
  await installMfaMock(page, { methods: ['totp', 'passkey'], settings: { 'security.step_up': 'on' } });
  await page.route('**/api/v1/auth/step-up/challenge', (route) =>
    json(route, { challenge_id: 'suc_mock', action: 'system.configure', expires_in: 60, methods: ['totp', 'passkey'],
      webauthn: { publicKey: { challenge: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', rpId: 'arx.example.com', timeout: 60000, userVerification: 'preferred', allowCredentials: [] } } }));
  const tab = await openPolicyTab(page);
  await tab.locator('sw-toggle[data-fp-wall]').click();
  await tab.locator('[data-fp-save]').click();
  const dlg = page.locator('sw-step-up-dialog');
  await dlg.locator('[data-step-up-passkey]').click();
  await expect(dlg.locator('[data-step-up-error]')).toContainText('arx.example.com');
  await expect(dlg.locator('[data-step-up-code]')).toBeVisible(); // the code still works here
});
