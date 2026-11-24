import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { installMfaMock, openPolicyTab, openSecurity, openUserDrawer } from './mfa-screens-mocks';

// MFA-SCREENS-2510 pixel baselines: החשבון שלי › אבטחה (the user menu with the open security section), משתמשים והרשאות › אימות דו־שלבי
// (the policy tab with the preview of an unsaved policy) and the user drawer's factors section - classic light, desktop 1440 and phone
// 390, against the mocked backend (tests/mfa-screens-mocks.ts). Baselines are per OS, generated on the runner and reviewed image by
// image; until they exist the checks are skipped (annotated), never failed on a missing file. The sign-in chooser is a dev-server page
// (unit-mfa-signin-methods-2510.spec.ts) and has compare-page pictures, no baseline.
//   SW_BASE_URL=<preview> npx playwright test tests/pixel-mfa-screens-2510.spec.ts --project=desktop --project=mobile [--update-snapshots=changed]
const noBaseline = (info: Pick<TestInfo, 'snapshotPath' | 'config'>, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function shoot(page: Page, info: TestInfo, name: string) {
  await page.mouse.move(0, 0);
  await settlePage(page);
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

test.describe('pixel: second-factor screens', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone only'));

  test('classic is pixel-stable: my account › security', async ({ page }, info) => {
    await installMfaMock(page);
    const { sec } = await openSecurity(page);
    await expect(sec.locator('sw-device-keys [data-device-key]')).toHaveCount(2);
    await shoot(page, info, 'mfa-account-security');
  });

  test('classic is pixel-stable: the policy tab with the preview of an unsaved policy', async ({ page }, info) => {
    await installMfaMock(page);
    const tab = await openPolicyTab(page);
    await tab.locator('sw-dropdown[data-fp-policy] [data-dropdown-chip]').click();
    await page.locator('[role="option"]', { hasText: 'חובה לכולם' }).first().click();
    await expect(tab.locator('[data-fp-preview-note]')).toBeVisible();
    await shoot(page, info, 'mfa-policy-preview');
  });

  test('classic is pixel-stable: the user drawer factors section', async ({ page }, info) => {
    await installMfaMock(page);
    const drawer = await openUserDrawer(page, 'רון לוי');
    await expect(drawer.locator('sw-user-factors [data-uf="passkeys"]')).toBeVisible();
    await shoot(page, info, 'mfa-user-drawer');
  });
});
