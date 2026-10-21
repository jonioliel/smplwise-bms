import { test, expect, type Page } from '@playwright/test';

// DDAREA-295: the home screen's floor and area pickers (devices-area-nav) follow the owner's "dropdown on the phone" choice
// (`data-dd-phone` on <html>, ui.dd_phone) like every other dropdown: list = a popover under the picker, sheet = the bottom sheet.
// Mock layer, no backend; the element is mounted on its own. One project only (desktop): the width is set inside the test.
//   ~/run_remote.sh spec <branch> tests/dropdown-area-nav-phone.spec.ts --project=desktop
const ADMIN = ['devices.read', 'devices.control', 'entity.state.read', 'map.read', 'system.configure'];

async function mock(page: Page) {
  await page.route('**/api/v1/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: 'בודק', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: 'בדיקה', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
        permissions_installation: ADMIN, permissions_any: ADMIN, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'ui.dd_phone': 'list' }, can_edit: false });
    if (p.startsWith('devices/tree')) {
      const counts = { entities: 3 };
      return json({ floors: [{ floor_id: 'f0', name: 'קומת קרקע', counts, areas: [{ area_id: 'a1', name: 'סלון', counts }] }, { floor_id: 'f1', name: 'קומה א', counts, areas: [{ area_id: 'a2', name: 'משרד', counts }] }] });
    }
    return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function stage(page: Page, phone: 'list' | 'sheet') {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('./?design=a&skin=classic&scheme=light#/devices/areas/a1');
  await page.waitForFunction(() => !!customElements.get('devices-area-nav'));
  await page.waitForTimeout(600);
  await page.evaluate((mode) => {
    document.documentElement.setAttribute('data-dd-phone', mode);
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:24px 16px';
    const nav = document.createElement('devices-area-nav') as HTMLElement & { areas: unknown[] };
    nav.id = 'nav';
    nav.setAttribute('areaId', 'a1');
    nav.setAttribute('areaName', 'סלון');
    nav.setAttribute('floorName', 'קומת קרקע');
    const c = { entities: 3, lights: 0, lights_on: 0 };
    nav.areas = [{ area_id: 'a1', name: 'סלון', counts: c }, { area_id: 'a3', name: 'מטבח', counts: c }];
    st.appendChild(nav);
    document.body.appendChild(st);
  }, phone);
}

for (const which of ['floor', 'area'] as const) {
  test(`phone, choice "list": the ${which} picker opens a popover under the picker, not a bottom sheet`, async ({ page }) => {
    await stage(page, 'list');
    const nav = page.locator('#nav');
    await nav.locator(`[data-crumb="${which}"]`).click();
    const menu = nav.locator(`[data-nav-menu="${which}"]`);
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((e) => getComputedStyle(e).position)).toBe('absolute');
    expect(await nav.evaluate((e) => e.hasAttribute('data-sheet'))).toBe(false);
    await expect(nav.locator('.back')).toHaveCount(0);
    const pick = (await nav.locator(`[data-crumb="${which}"]`).boundingBox())!;
    const box = (await menu.boundingBox())!;
    expect(Math.round(box.y)).toBeGreaterThanOrEqual(Math.round(pick.y + pick.height)); // under the picker
    expect(Math.round(box.y + box.height)).toBeLessThan(800); // not pinned to the bottom edge
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });

  test(`phone, choice "sheet": the ${which} picker still opens the bottom sheet`, async ({ page }) => {
    await stage(page, 'sheet');
    const nav = page.locator('#nav');
    await nav.locator(`[data-crumb="${which}"]`).click();
    const menu = nav.locator(`[data-nav-menu="${which}"]`);
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((e) => getComputedStyle(e).position)).toBe('fixed');
    expect(await nav.evaluate((e) => e.hasAttribute('data-sheet'))).toBe(true);
    const box = (await menu.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(800); // pinned to the bottom edge
  });
}
