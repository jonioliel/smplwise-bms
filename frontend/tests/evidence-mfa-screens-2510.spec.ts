import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { GOOD, GOOD_RECOVERY, GOOD_SIGNATURE, installMfaMock, isPhone, openPolicyTab, openSecurity, openUserDrawer } from './mfa-screens-mocks';

// MFA-SCREENS-2510 (slice 11 of the second-factor train), against a MOCKED backend (tests/mfa-screens-mocks.ts; invented users):
//   1. החשבון שלי › אבטחה - the overview (authenticator on, passkeys, phone keys, recovery codes low, a long-lived token), each block in
//      place, the phone keys list (attestation badges) and a revoke that the shell's step-up dialog confirms - the DELETE is sent once
//      more after the proof and only once;
//   2. משתמשים והרשאות › אימות דו־שלבי - the policy, report / enforce, the wall exemption, long-lived tokens, the compliance view, the
//      PREVIEW of an unsaved policy (`?policy=`), step-up off by default (minutes and local switch disabled), one save with only the changes;
//      read-only for a holder of rbac.assign without system.configure;
//   3. the user drawer - the factors list, the policy verdict, and the reset for a user with passkeys but no authenticator code.
// axe (axe-core, when the package resolves) on each screen: no serious / critical violation inside this slice's elements.
//   SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/evidence-mfa-screens-2510.spec.ts --project=desktop --project=mobile --workers=2
// SW_SHOTS_DIR=<dir> also writes the compare-page pictures (light + dark) of the three screens.

const skipTablet = () => test.skip(test.info().project.name === 'tablet', 'desktop + phone');

const require_ = createRequire(import.meta.url);
function axeSource(): string | null {
  try {
    return fs.readFileSync(require_.resolve('axe-core/axe.min.js'), 'utf8');
  } catch {
    return null;
  }
}

/** axe-core on the whole page (shadow roots included); returns the serious and critical violations whose nodes lie inside one of
 * `within` (custom element tags of this slice's screens - the shell around them is not this slice's business). Skips (annotated)
 * when axe-core is not installed. */
async function axe(page: Page, within: string[]): Promise<string[]> {
  const src = axeSource();
  if (!src) {
    test.info().annotations.push({ type: 'axe', description: 'axe-core not installed: not run' });
    return [];
  }
  await page.addScriptTag({ content: src });
  const found = await page.evaluate(async () => {
    const w = window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: unknown }[] }[] }> } };
    const r = await w.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').flatMap((v) => v.nodes.map((n) => `${v.id}: ${JSON.stringify(n.target)}`));
  });
  return found.filter((line) => within.some((tag) => line.includes(tag)));
}

test('my account › security: the overview, every block, the phone keys and a revoke confirmed once by the step-up dialog', async ({ page }) => {
  skipTablet();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await installMfaMock(page);
  const { sec } = await openSecurity(page);
  const ov = sec.locator('[data-sec-overview]');
  await expect(ov.locator('[data-sec-line="totp"]')).toContainText('פעיל');
  await expect(ov.locator('[data-sec-line="passkeys"]')).toContainText('1');
  await expect(ov.locator('[data-sec-line="device-keys"]')).toContainText('2');
  await expect(ov.locator('[data-sec-line="recovery"]')).toContainText('3 מתוך 10');
  await expect(ov.locator('[data-sec-line="recovery"]')).toHaveAttribute('data-state', 'warn');
  await expect(ov.locator('[data-sec-line="long-lived"]')).toContainText('1');
  for (const b of ['totp', 'passkeys', 'device-keys', 'tokens']) await expect(sec.locator(`[data-sec-block="${b}"]`)).toBeVisible();
  await expect(sec.locator('[data-sec-block="totp"] sw-second-factor [data-sf-recovery-count]')).toContainText('3 מתוך 10');
  await expect(sec.locator('[data-sec-block="tokens"] [data-kind="long_lived"]')).toContainText('Node-RED');

  const keys = sec.locator('sw-device-keys [data-device-key]');
  await expect(keys).toHaveCount(2);
  await expect(keys.first().locator('[data-device-key-attested]')).toContainText('מאומת בחומרה');
  await expect(keys.nth(1).locator('[data-device-key-attested]')).toContainText('מפתח תוכנה');
  expect(await axe(page, ['sw-account-security', 'sw-device-keys', 'data-my-security'])).toEqual([]);

  // revoke: asks once more in place, then the server wants a fresh step-up -> the shell's dialog -> the same DELETE once more, once
  const first = keys.first();
  await first.locator('[data-revoke-device-key]').click();
  await expect(first.locator('[data-revoke-device-key]')).toContainText('לבטל?');
  expect(mock.calls.filter((c) => c.method === 'DELETE')).toEqual([]);
  await first.locator('[data-revoke-device-key]').click();
  const dialog = page.locator('sw-step-up-dialog');
  await expect(dialog.locator('[data-step-up-code]')).toBeVisible();
  await dialog.locator('[data-step-up-code]').fill(GOOD);
  await dialog.locator('[data-step-up-confirm]').click();
  await expect(sec.locator('[data-device-keys-message]')).toHaveText('מפתח הטלפון בוטל.');
  await expect(sec.locator('sw-device-keys [data-device-key]')).toHaveCount(1);
  expect(mock.calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual(['auth/device-keys/dk_pixel000000000000001', 'auth/device-keys/dk_pixel000000000000001']);
  await expect(ov.locator('[data-sec-line="device-keys"]')).toContainText('1');
  expect(errors).toEqual([]);
});

test('my account › security: a cancelled step-up keeps the key and says so; nothing is sent again', async ({ page }) => {
  skipTablet();
  const mock = await installMfaMock(page);
  const { sec } = await openSecurity(page);
  const first = sec.locator('sw-device-keys [data-device-key]').first();
  await first.locator('[data-revoke-device-key]').click();
  await first.locator('[data-revoke-device-key]').click();
  const dialog = page.locator('sw-step-up-dialog');
  await dialog.locator('[data-step-up-cancel]').click();
  await expect(sec.locator('[data-device-keys-error]')).toContainText('לאשר שוב את הזהות');
  await expect(sec.locator('sw-device-keys [data-device-key]')).toHaveCount(2);
  expect(mock.calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
});

test('users & permissions › second factor: the policy, the compliance view and the preview of an unsaved policy', async ({ page }) => {
  skipTablet();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await installMfaMock(page);
  const tab = await openPolicyTab(page);
  const comp = tab.locator('[data-fp-compliance]');
  await expect(comp.locator('[data-fp-stat="covered"] b')).toHaveText('2');
  await expect(comp.locator('[data-fp-stat="missing"] b')).toHaveText('1');
  await expect(comp.locator('[data-fp-people="missing"] [data-fp-person]')).toHaveCount(1);
  await expect(comp.locator('[data-fp-report-note]')).toBeVisible();
  await expect(comp).toHaveAttribute('data-fp-preview', '');
  await expect(tab.locator('[data-fp-save]')).toHaveAttribute('disabled', '');
  expect(await axe(page, ['sw-factor-policy-admin'])).toEqual([]);

  // a different policy, not saved: the server's preview of it ("these users would have to enrol")
  await tab.locator('sw-dropdown[data-fp-policy] [data-dropdown-chip]').click();
  await page.locator('[role="option"]', { hasText: 'חובה לכולם' }).first().click();
  await expect(comp).toHaveAttribute('data-fp-preview', 'all');
  await expect(comp.locator('[data-fp-preview-note]')).toContainText('חובה לכולם');
  await expect(comp.locator('[data-fp-stat="missing"] b')).toHaveText('3');
  await expect(comp.locator('[data-fp-people="missing"] [data-fp-person]')).toHaveCount(3);
  expect(mock.calls.some((c) => c.path === 'security/factor-policy?policy=all')).toBe(true);
  expect(mock.calls.filter((c) => c.method === 'PATCH')).toEqual([]);

  // enforce + save: only the two changes are sent; the preview ends with the save
  await tab.locator('[data-fp-mode-option="enforce"]').click();
  await tab.locator('[data-fp-save]').click();
  await expect(tab.locator('[data-fp-message]')).toBeVisible();
  expect(mock.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ 'security.factor_policy': 'all', 'security.factor_policy_mode': 'enforce' }]);
  await expect(comp).toHaveAttribute('data-fp-preview', '');
  await expect(comp.locator('[data-fp-stat="missing"] b')).toHaveText('3');
  expect(errors).toEqual([]);
});

test('users & permissions › second factor: step-up is off by default; switching it on enables the minutes and the local switch', async ({ page }) => {
  skipTablet();
  const mock = await installMfaMock(page);
  const tab = await openPolicyTab(page);
  const card = tab.locator('[data-fp-step-up-card]');
  await expect(card.locator('sw-toggle[data-fp-step-up]')).not.toHaveAttribute('checked', '');
  await expect(card.locator('input[data-fp-minutes]')).toBeDisabled();
  await expect(card.locator('sw-toggle[data-fp-step-up-local]')).toHaveAttribute('disabled', '');
  await expect(card.locator('[data-step-up-mine="off"]')).toBeVisible();
  await card.locator('sw-toggle[data-fp-step-up]').click();
  await expect(card.locator('input[data-fp-minutes]')).toBeEnabled();
  await card.locator('input[data-fp-minutes]').fill('10');
  await card.locator('input[data-fp-minutes]').dispatchEvent('change');
  await tab.locator('[data-fp-save]').click();
  await expect(tab.locator('[data-fp-message]')).toBeVisible();
  expect(mock.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ 'security.step_up': 'on', 'security.step_up_minutes': 10 }]);
  await expect(page.locator('sw-step-up-dialog')).toHaveCount(0); // it was off when saved: nothing asked
});

test('users & permissions › second factor: read-only for a holder of rbac.assign alone', async ({ page }) => {
  skipTablet();
  await installMfaMock(page, { reader: true });
  const tab = await openPolicyTab(page);
  await expect(tab.locator('[data-fp-readonly]')).toBeVisible();
  await expect(tab.locator('[data-fp-save]')).toHaveCount(0);
  await expect(tab.locator('sw-dropdown[data-fp-policy]')).toHaveCount(0);
  await expect(tab.locator('[data-fp-policy-ro]')).toHaveText('חובה למנהלים');
  await expect(tab.locator('sw-toggle[data-fp-wall]')).toHaveAttribute('disabled', '');
});

test('user drawer: the factors list and the policy verdict; the authenticator row keeps its own reset', async ({ page }) => {
  skipTablet();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await installMfaMock(page);
  const drawer = await openUserDrawer(page, 'דנה כהן');
  const f = drawer.locator('sw-user-factors');
  await expect(f.locator('[data-uf="passkeys"]')).toContainText('1');
  await expect(f.locator('[data-uf="device-keys"]')).toContainText('2');
  await expect(f.locator('[data-uf="recovery"]')).toContainText('7 מתוך 10');
  await expect(f.locator('[data-uf="ha-mfa"]')).toBeVisible();
  await expect(f.locator('[data-uf="policy"]')).toContainText('רשות');
  await expect(f.locator('[data-sf-admin-state]')).toContainText('פעיל'); // the authenticator row (its own reset)
  await expect(f.locator('[data-uf-reset]')).toHaveCount(0);
  expect(await axe(page, ['sw-user-factors'])).toEqual([]);
  expect(errors).toEqual([]);
});

test('user drawer: a user with passkeys but no authenticator code - the reset, with the administrator own code', async ({ page }) => {
  skipTablet();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await installMfaMock(page);
  const drawer = await openUserDrawer(page, 'רון לוי');
  const f = drawer.locator('sw-user-factors');
  await expect(f.locator('[data-uf="passkeys"]')).toContainText('2');
  await expect(f.locator('[data-uf="policy"]')).toContainText('חובה');
  await expect(f.locator('[data-sf-admin-state]')).toContainText('כבוי');
  await f.locator('[data-uf-reset]').click();
  await expect(f.locator('[data-uf-reset-confirm]')).toBeVisible();
  // RELEASE-2510-TRAIN: the preflight says what goes and what happens; the username must be typed (MFA-RESET-HARDENING-2510)
  await expect(f.locator('[data-reset-removes]')).toContainText('מפתחות גישה: 2');
  await expect(f.locator('[data-reset-after]')).toContainText('יצטרך להגדיר אימות דו־שלבי מחדש');
  await expect(f.locator('[data-reset-confirm-label]')).toContainText('ron');
  // the administrator has an authenticator code: the confirm waits for six digits AND the typed username
  await expect(f.locator('[data-uf-reset-confirm]')).toHaveAttribute('disabled', '');
  await f.locator('[data-uf-code]').fill(GOOD);
  await expect(f.locator('[data-uf-reset-confirm]')).toHaveAttribute('disabled', '');
  await f.locator('[data-reset-confirm-text]').fill('rn');
  await expect(f.locator('[data-uf-reset-confirm]')).toHaveAttribute('disabled', '');
  await f.locator('[data-reset-confirm-text]').fill(' Ron ');
  await expect(f.locator('[data-uf-reset-confirm]')).not.toHaveAttribute('disabled', '');
  await f.locator('[data-uf-reset-confirm]').click();
  await expect(f.locator('[data-uf-message]')).toBeVisible();
  await expect(f.locator('[data-uf="passkeys"]')).toContainText('אין');
  const deletes = mock.calls.filter((c) => c.method === 'DELETE');
  expect(deletes.map((c) => c.path)).toEqual(['auth/second-factor/users/u-ron']);
  expect(deletes.map((c) => c.body)).toEqual([{ confirm: ' Ron ' }]);
  expect(mock.calls.filter((c) => c.path === 'auth/second-factor/users/u-ron/reset-check')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('user drawer: the reset preflight refuses (the last administrator who can sign in remotely) - no confirm button, nothing sent', async ({ page }) => {
  skipTablet();
  const mock = await installMfaMock(page, { resetRefusal: 'last_admin' });
  const drawer = await openUserDrawer(page, 'רון לוי');
  const f = drawer.locator('sw-user-factors');
  await f.locator('[data-uf-reset]').click();
  await expect(f.locator('[data-reset-refused="last_admin"]')).toContainText('מנהל המערכת האחרון');
  await expect(f.locator('[data-uf-reset-confirm]')).toHaveCount(0);
  await expect(f.locator('[data-reset-confirm-text]')).toHaveCount(0);
  expect(mock.calls.filter((c) => c.method === 'DELETE')).toEqual([]);
});

// ---------------------------------------------------------------- the step-up dialog's other methods (MFA-SECFIX-2500 open question 5)

test('step-up is OFF when the server stores no value (owner Q2 = b): the switch reads off, nothing is asked', async ({ page }) => {
  skipTablet();
  const mock = await installMfaMock(page, { settings: { 'security.step_up': undefined } });
  const tab = await openPolicyTab(page);
  await expect(tab.locator('[data-fp-step-up-card] sw-toggle[data-fp-step-up]')).not.toHaveAttribute('checked', '');
  await tab.locator('[data-fp-mode-option="enforce"]').click();
  await tab.locator('[data-fp-save]').click();
  await expect(tab.locator('[data-fp-message]')).toBeVisible();
  await expect(page.locator('sw-step-up-dialog')).toHaveCount(0);
  expect(mock.verifies).toEqual([]);
});

/** Step-up on, a change saved: the gate's 403 opens the shell dialog. */
async function saveWithStepUp(page: Page, methods: string[]) {
  const mock = await installMfaMock(page, { settings: { 'security.step_up': 'on' }, methods });
  const tab = await openPolicyTab(page);
  await tab.locator('[data-fp-mode-option="enforce"]').click();
  await tab.locator('[data-fp-save]').click();
  const dialog = page.locator('sw-step-up-dialog');
  // the open dialog's content is drawn in the top layer and the <sw-dialog> host has no box of its own: its footer button is the visible sign
  await expect(dialog.locator('[data-step-up-cancel]')).toBeVisible();
  return { mock, tab, dialog };
}

test('step-up dialog: a recovery code confirms the normal window; the save is sent once more and only once', async ({ page }) => {
  skipTablet();
  const { mock, tab, dialog } = await saveWithStepUp(page, ['totp']);
  const field = dialog.locator('[data-step-up-code]');
  await expect(field).toHaveAttribute('inputmode', 'numeric');
  await dialog.locator('[data-step-up-recovery]').click();
  await expect(field).toHaveAttribute('inputmode', 'text');
  await expect(field).toHaveAttribute('placeholder', 'XXXX-XXXX');
  await field.fill('123456');
  await expect(dialog.locator('[data-step-up-confirm]')).toHaveAttribute('disabled', '');
  await field.fill(GOOD_RECOVERY);
  await dialog.locator('[data-step-up-confirm]').click();
  await expect(tab.locator('[data-fp-message]')).toBeVisible();
  expect(mock.verifies).toEqual([{ method: 'recovery_code', code: GOOD_RECOVERY, action: 'system.configure' }]);
  expect(mock.calls.filter((c) => c.method === 'PATCH')).toHaveLength(2); // refused once, sent once more
});

test('step-up dialog: the phone key inside the Android app - the app signs the server challenge; outside the app it is not offered', async ({ page }) => {
  skipTablet();
  // the Android shell's bridge (mobile/android-shell BridgeScript.kt), faked: a key exists, the prompt signs
  await page.addInitScript((sig) => {
    const w = window as unknown as Record<string, unknown>;
    w.__signed = [];
    w.ArxApp = { deviceKey: {
      status: () => Promise.resolve({ available: true, exists: true, keyId: 'dk_pixel000000000000001', authKind: 'biometric' }),
      sign: (payload: string, text: string) => { (w.__signed as unknown[]).push([payload, text]); return Promise.resolve({ signature: sig }); },
    } };
  }, GOOD_SIGNATURE);
  const { mock, tab, dialog } = await saveWithStepUp(page, ['totp', 'device_key']);
  await dialog.locator('[data-step-up-device-key]').click();
  await expect(tab.locator('[data-fp-message]')).toBeVisible();
  expect(mock.verifies).toEqual([{ method: 'device_key', challenge_id: 'dkc_mock1', key_id: 'dk_pixel000000000000001', signature: GOOD_SIGNATURE, action: 'system.configure' }]);
  expect(mock.calls.filter((c) => c.path === 'auth/device-keys/challenge').map((c) => c.body)).toEqual([{ purpose: 'step_up', key_id: 'dk_pixel000000000000001', action: 'system.configure' }]);
  expect(await page.evaluate(() => (window as unknown as { __signed: unknown[] }).__signed)).toEqual([['arx-device-key|step_up|mock', 'אישור זהות']]);
});

test('step-up dialog: phone key listed but not in the app - the code only, no phone-key button', async ({ page }) => {
  skipTablet();
  const { dialog } = await saveWithStepUp(page, ['totp', 'device_key']);
  await expect(dialog.locator('[data-step-up-code]')).toBeVisible();
  await expect(dialog.locator('[data-step-up-device-key]')).toHaveCount(0);
  await expect(dialog.locator('[data-step-up-recovery]')).toBeVisible();
});

test('step-up dialog: a phone-key-only user outside the app is told to confirm from the app', async ({ page }) => {
  skipTablet();
  const { dialog } = await saveWithStepUp(page, ['device_key']);
  await expect(dialog.locator('[data-step-up-no-method]')).toContainText('אפליקציית Android');
  await expect(dialog.locator('[data-step-up-recovery]')).toHaveCount(0);
});

// ---------------------------------------------------------------- compare-page pictures (SW_SHOTS_DIR only; before and after builds)

const SHOTS = process.env.SW_SHOTS_DIR || '';
test('shots: the three screens, light and dark', async ({ page }) => {
  skipTablet();
  test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
  test.setTimeout(120_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const vp = isPhone(page) ? 'phone' : 'desktop';
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).ArxApp = { deviceKey: {
      status: () => Promise.resolve({ available: true, exists: true, keyId: 'dk_pixel000000000000001' }),
      sign: () => new Promise(() => undefined),
    } };
  });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await installMfaMock(page);
    const shot = async (name: string) => {
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SHOTS, `${name}-${vp}-${scheme}.png`) });
    };
    // 1. the account level: the security section when it exists (after), else the second factor section (before)
    await page.goto('/?design=a#/system/access');
    await page.waitForSelector('sw-app');
    await page.locator(isPhone(page) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
    const menu = page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
    await menu.locator('[data-menu-account]').click();
    await menu.locator('[data-my-second-factor] summary').click();
    await page.waitForTimeout(800);
    await shot('account');
    // 2. the policy tab (after) / the remote-access tab's step-up card (before)
    await page.goto('/?design=a#/system/access?tab=factor');
    await page.waitForSelector('sw-app system-access');
    await page.waitForTimeout(800);
    if (await page.locator('sw-factor-policy-admin [data-fp-admin]').count()) {
      await shot('policy');
      await page.locator('sw-factor-policy-admin sw-dropdown[data-fp-policy] [data-dropdown-chip]').click();
      await page.locator('[role="option"]', { hasText: 'חובה לכולם' }).first().click();
      await expect(page.locator('sw-factor-policy-admin [data-fp-preview-note]')).toBeVisible();
      await page.locator('sw-factor-policy-admin [data-fp-compliance]').scrollIntoViewIfNeeded();
      await shot('policy-preview');
    } else {
      await page.goto('/?design=a#/system/diagnostics?tab=remote');
      await page.waitForSelector('sw-app system-diagnostics');
      const card = page.locator('system-diagnostics [data-step-up-settings]');
      if (await card.count()) await card.scrollIntoViewIfNeeded();
      await shot('policy');
    }
    // 3. the user drawer of a user with passkeys only
    await openUserDrawer(page, 'רון לוי');
    await page.waitForTimeout(600);
    await shot('drawer');
    // 4. the step-up dialog (step-up on; the code and the phone key listed; the app's bridge faked): phone key + recovery (after)
    await installMfaMock(page, { settings: { 'security.step_up': 'on' }, methods: ['totp', 'device_key'] });
    await page.goto('/?design=a#/system/access?tab=factor');
    await page.waitForSelector('sw-app system-access');
    await page.waitForTimeout(800);
    if (await page.locator('sw-factor-policy-admin [data-fp-admin]').count()) {
      await page.locator('sw-factor-policy-admin [data-fp-mode-option="enforce"]').click();
      await page.locator('sw-factor-policy-admin [data-fp-save]').click();
    } else {
      await page.goto('/?design=a#/system/diagnostics?tab=remote');
      await page.waitForSelector('sw-app system-diagnostics');
      const minutes = page.locator('system-diagnostics input[data-set-step-up="security.step_up_minutes"]');
      await minutes.fill('10');
      await minutes.dispatchEvent('change');
      await page.locator('system-diagnostics [data-save-remote]').click();
    }
    const dialog = page.locator('sw-step-up-dialog');
    await expect(dialog.locator('[data-step-up-code]')).toBeVisible();
    await shot('dialog');
    if (await dialog.locator('[data-step-up-recovery]').count()) {
      await dialog.locator('[data-step-up-recovery]').click();
      await shot('dialog-recovery');
    }
    await dialog.locator('[data-step-up-cancel]').click();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});
