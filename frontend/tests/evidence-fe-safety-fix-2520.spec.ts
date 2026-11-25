import { test, expect } from '@playwright/test';
import { GOOD, installMfaMock, openUserDrawer } from './mfa-screens-mocks';

// FE-SAFETY-FIX-2520 (deep review 2520 frontend core, FC-04 - the typed-confirmation half), against the MOCKED backend of
// tests/mfa-screens-mocks.ts (invented users): in the user drawer's reset of the other authentication methods, Enter in the typed
// username field resets ONLY when the typed name matches; a wrong name + Enter sends nothing. (The confirmation dialog's keyboard is
// in evidence-confirm-dialog-2438.spec.ts, test "FE-SAFETY-FIX-2520 FC-04".)
//   SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/evidence-fe-safety-fix-2520.spec.ts --project=desktop --workers=1

test('typed confirmation: Enter with a wrong username sends nothing; with the right one it resets once', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one viewport is enough for the behaviour');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await installMfaMock(page);
  const drawer = await openUserDrawer(page, 'רון לוי');
  const f = drawer.locator('sw-user-factors');
  await f.locator('[data-uf-reset]').click();
  await expect(f.locator('[data-uf-reset-confirm]')).toBeVisible();
  await f.locator('[data-uf-code]').fill(GOOD);
  const typed = f.locator('[data-reset-confirm-text]');

  await typed.fill('rn');
  await typed.press('Enter');
  await expect(f.locator('[data-uf-reset-confirm]')).toHaveAttribute('disabled', '');
  await page.waitForTimeout(300); // a request would have left by now
  expect(mock.calls.filter((c) => c.method === 'DELETE')).toEqual([]);

  await typed.fill(' Ron ');
  await typed.press('Enter');
  await expect(f.locator('[data-uf-message]')).toBeVisible();
  const deletes = mock.calls.filter((c) => c.method === 'DELETE');
  expect(deletes.map((c) => c.path)).toEqual(['auth/second-factor/users/u-ron']);
  expect(deletes.map((c) => c.body)).toEqual([{ confirm: ' Ron ' }]);
  expect(errors).toEqual([]);
});
