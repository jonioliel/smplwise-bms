import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installMfaMock, openPolicyTab } from './mfa-screens-mocks';

// MFA-HA-PASSKEY-2520: Settings › Users & permissions › Second factor gains one switch - "Passkey at sign-in"
// (`security.passkey_remote_factor`, default off = the behaviour of before). Against the mocked backend of MFA-SCREENS-2510
// (tests/mfa-screens-mocks.ts; invented users): off when the server leaves the key out, one PATCH with only that change when switched
// on, read-only for a holder of rbac.assign alone.
//   SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/evidence-mfa-ha-passkey-2520.spec.ts --project=desktop --project=mobile --workers=2
// SW_SHOTS_DIR=<dir> also writes the compare-page pictures of the policy card (light + dark).

const skipTablet = () => test.skip(test.info().project.name === 'tablet', 'desktop + phone');

test('the passkey switch is off by default and saves alone', async ({ page }) => {
  skipTablet();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await installMfaMock(page);
  const tab = await openPolicyTab(page);
  const row = tab.locator('[data-fp-policy-card] [data-fp-row="passkey"]');
  await expect(row).toBeVisible();
  await expect(row).toContainText('מפתח גישה כאימות בכניסה');
  const toggle = row.locator('sw-toggle[data-fp-passkey]');
  await expect(toggle).not.toHaveAttribute('checked', '');
  await expect(tab.locator('[data-fp-save]')).toHaveAttribute('disabled', '');
  await toggle.click();
  await tab.locator('[data-fp-save]').click();
  await expect(tab.locator('[data-fp-message]')).toBeVisible();
  expect(mock.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ 'security.passkey_remote_factor': 'on' }]);
  expect(errors).toEqual([]);
});

test('the passkey switch shows the stored value and is read-only for a holder of rbac.assign alone', async ({ page }) => {
  skipTablet();
  await installMfaMock(page, { reader: true, settings: { 'security.passkey_remote_factor': 'on' } });
  const tab = await openPolicyTab(page);
  const toggle = tab.locator('sw-toggle[data-fp-passkey]');
  await expect(toggle).toHaveAttribute('disabled', '');
  await expect(toggle).toHaveAttribute('checked', '');
});

const SHOTS = process.env.SW_SHOTS_DIR || '';
test('shots: the policy card with the passkey switch', async ({ page }) => {
  skipTablet();
  test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
  fs.mkdirSync(SHOTS, { recursive: true });
  const phone = test.info().project.name === 'mobile';
  await installMfaMock(page);
  const tab = await openPolicyTab(page);
  const card = tab.locator('[data-fp-policy-card]');
  await card.scrollIntoViewIfNeeded();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.waitForTimeout(250);
    await card.screenshot({ path: path.join(SHOTS, `policy-card-${phone ? 'phone' : 'desktop'}-${scheme}.png`) });
  }
});
