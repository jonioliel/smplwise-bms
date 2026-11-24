import { test, type Page } from '@playwright/test';
import { PERMS, freshMock, mockSt7Backend, openSt7, settle } from './st7-ui-mocks';

// HAND-SWITCH-HOME-PERSONAL-2500: before / after captures of "החשבון שלי › המסך שלי" for the owner's compare page (not a gate).
// Runs only with SW_SHOTS=1 and writes <SW_SHOTS_DIR>/<SW_SHOTS_PHASE>-<size>-<scheme>.png over the mocked backend of
// tests/st7-ui-mocks.ts. The same file runs against the build before the change (the widget rows carry check boxes) and after it
// (the compact switch). Desktop 1440x900 and phone 390x844, light and dark.

const OUT = process.env.SW_SHOTS_DIR || '../private/planning/hand_switch_home_personal_compare_2026-11-24';
const PHASE = process.env.SW_SHOTS_PHASE || 'after';
const SIZES: [string, number, number][] = [['desktop', 1440, 900], ['phone', 390, 844]];

/** The mocked user also holds screen.personalize, so the user menu offers "המסך שלי" (as tests/evidence-ui-polish-2443.spec.ts). */
async function mayPersonalize(page: Page) {
  const perms = [...PERMS, 'screen.personalize'];
  await page.route('**/api/v1/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'יוני', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'מנהל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      }),
    }));
}

test.describe('HAND-SWITCH-HOME-PERSONAL-2500 captures', () => {
  test.skip(process.env.SW_SHOTS !== '1', 'captures only with SW_SHOTS=1');
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'sizes are set per capture'); });

  for (const [size, w, h] of SIZES) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${size} ${scheme}: my screen, the widget rows`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: scheme });
        await mockSt7Backend(page, freshMock());
        await mayPersonalize(page);
        await openSt7(page, '/system/diagnostics?tab=map', scheme === 'dark' ? '&scheme=dark' : '');
        if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await page.locator('sw-app [data-profile-menu]').click();
        await page.locator('sw-app sw-user-menu [data-menu-account]').click();
        await page.locator('sw-app sw-user-menu [data-my-home] summary').click();
        const mine = page.locator('sw-app sw-user-menu sw-home-personal');
        const first = mine.locator('[data-home-personal-widget]').first();
        await first.waitFor({ timeout: 15_000 });
        await first.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await settle(page);
        await page.screenshot({ path: `${OUT}/${PHASE}-${size}-${scheme}.png` });
      });
    }
  }
});
