import { test, expect, type Page } from '@playwright/test';
import { MENU_SCHEMES, MENU_SKINS, expectOpaqueMenu, openApp, type MenuScheme, type MenuSkin } from './menu-opaque-harness';

// Menus are never see-through (owner 2026-10-13: the user menu was half transparent over the building tree in the glass look and the
// texts overlapped). For every skin x scheme (and the phone's bottom sheet) a menu is opened for real and what it paints is READ from the
// browser: background alpha 1, the colour is the menu token, no backdrop-filter, nothing above it fades it.
//   SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test tests/evidence-menu-opaque.spec.ts --workers=1 --project=desktop --project=mobile
// The static twin is tests/unit-menu-lint.spec.ts (it scans the menu components' CSS), the token twin tests/unit-menu-surfaces.spec.ts.

const isPhone = (info: { project: { name: string } }) => info.project.name === 'mobile';

async function openUserMenu(page: Page, phone: boolean) {
  await page.locator(phone ? 'button[data-nav-me]' : 'button[data-profile-menu]').first().click();
  await expect(page.locator('sw-user-menu[open]')).toHaveCount(1);
  return page.locator('sw-user-menu .panel');
}

test.describe('the user menu is opaque in every skin and scheme', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  for (const skin of MENU_SKINS) {
    for (const scheme of MENU_SCHEMES) {
      test(`user menu: ${skin} / ${scheme}`, async ({ page }, info) => {
        test.skip(info.project.name === 'tablet', 'a popover (desktop) and a bottom sheet (phone) are the two forms');
        await openApp(page, skin as MenuSkin, scheme as MenuScheme, '/devices/building');
        const panel = await openUserMenu(page, isPhone(info));
        await expect(panel).toBeVisible();
        const p = await expectOpaqueMenu(panel, `user menu ${skin}/${scheme}/${info.project.name}`);
        // the form: the panel really is the popover (desktop) or the sheet (phone) it claims to be
        const box = await panel.boundingBox();
        expect(box, 'the panel is on screen').toBeTruthy();
        if (isPhone(info)) expect(box!.width).toBeGreaterThanOrEqual(380);
        else expect(box!.width).toBeLessThan(400);
        // the colour of the menu is this skin's own (a skin that forgot its pair would show classic's white in dark)
        expect(p.token).not.toBe('');
      });
    }
  }

  test('user menu: the account level (a second panel content) stays opaque and the dividers read', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the level switch is the same on every width');
    await openApp(page, 'domus', 'light', '/devices/building');
    const panel = await openUserMenu(page, false);
    await page.locator('sw-user-menu [data-menu-account]').click();
    await expect(page.locator('sw-user-menu [data-menu-level="account"]')).toBeVisible();
    await expectOpaqueMenu(panel, 'user menu / account level');
    // the divider under the header is the menu hairline (an opaque colour), not the white glass rim that vanishes on a white surface
    const line = await page.locator('sw-user-menu ul[data-menu-level="account"]').evaluate((u) => getComputedStyle(u).borderBlockStartColor);
    expect(line).toBe('rgb(223, 225, 230)');
  });
});
