import { type Page, type Route, test } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHome } from './home-simple-mocks';

// DESIGN-LITERALS-2510: before / after captures of the home interface administration page (הגדרות › גישה › ממשק ביתי) - the four
// sub-tabs (people, installation settings, wall panels, switch classification with the bulk bar) - desktop 1440 and phone 390, light
// and dark. Not a gate: the same file runs against the build before the tokenising and after it, and the two folders are compared
// pixel by pixel (0 differing pixels expected: the tokens carry the same values). Runs only with SW_SHOTS=1 and writes
// <SW_SHOTS_DIR>/admin-<tab>-<size>-<scheme>.png. Mocked backend (the shapes of home-simple-2421.spec.ts).

const OUT = process.env.SW_SHOTS_DIR || 'test-results/design-literals-2510';
const SIZES: [string, number, number][] = [['d1440', 1440, 900], ['p390', 390, 844]];
const ok = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function adminPage(page: Page) {
  await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
  const users = [
    { user_id: 'dev-noa', username: 'noa', display_name: 'נועה לביא', source: 'ingress', system_admin: false, default_interface: 'full', may_switch: true, home_only: false, kiosk: false, kiosk_area_id: null, rooms: null, modules: null, configured: true, admin: false, can_invite: true, guests: true },
    { user_id: 'dev-yuval', username: 'yuval', display_name: 'יובל לביא', source: 'ingress', system_admin: false, default_interface: 'home', may_switch: false, home_only: true, kiosk: false, kiosk_area_id: null, rooms: null, modules: null, configured: true, admin: false },
  ];
  const settings = { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'gallery', wall_rest: 'on', wall_rest_after: '2', wall_night: 'on', wall_night_start: '23:00', wall_night_end: '06:00', wall_night_dim: 'medium', wall_takeover: 'alarm_urgent', wall_notice_new: '48', building_all: 'hide' };
  const switches = [
    { entity_id: 'switch.boiler', name: 'דוד שמש', area_id: 'bath', area_name: 'חדר רחצה', floor_name: null, state: 'on', available: true, class: 'not_light', suggest: 'protected', suggest_reason: 'דוד מים', locked: null },
    { entity_id: 'switch.strip', name: 'פס תאורה', area_id: 'living', area_name: 'סלון', floor_name: null, state: 'off', available: true, class: 'not_light', suggest: 'light', suggest_reason: 'השם כולל מילה של תאורה', locked: null },
    { entity_id: 'switch.pump', name: 'משאבה', area_id: 'garden', area_name: 'גינה', floor_name: null, state: 'off', available: true, class: 'not_light', suggest: null, suggest_reason: null, locked: null },
  ];
  await page.route('**/api/v1/home/policies', (r) => ok(r, { users, modules: ['lights'], seed: {}, kiosk_code_set: true }));
  await page.route('**/api/v1/home/settings', (r) => ok(r, { settings, values: {}, gallery: [] }));
  await page.route('**/api/v1/home/switches', (r) => ok(r, { switches, summary: {} }));
  await page.route('**/api/v1/identity/users**', (r) => ok(r, { users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false }));
  await page.route('**/api/v1/access/roles**', (r) => ok(r, { roles: [] }));
  await page.route('**/api/v1/access/groups**', (r) => ok(r, { groups: [], can_manage: true }));
  await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/#/system/access?tab=home');
  const admin = page.locator('sw-home-admin');
  await admin.locator('[data-home-detail] h3').waitFor({ state: 'attached' });
  return admin;
}

async function shot(page: Page, name: string) {
  await settle(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/admin-${name}.png` });
}

test.describe('DESIGN-LITERALS-2510 captures', () => {
  test.skip(!process.env.SW_SHOTS, 'evidence only');
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'sizes are set per test'); });
  test.setTimeout(180_000);

  for (const scheme of ['light', 'dark'] as const) {
    for (const [size, w, h] of SIZES) {
      test(`home administration ${size} ${scheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await page.setViewportSize({ width: w, height: h });
        const admin = await adminPage(page);
        await shot(page, `users-${size}-${scheme}`);
        const tab = (label: string) => admin.locator('[data-home-subtabs] [role="tab"]', { hasText: label }).click();
        await tab('הגדרות התקנה');
        await admin.locator('[data-install="default_mode:full_all"]').waitFor();
        await shot(page, `install-${size}-${scheme}`);
        await tab('מסכי קיר');
        await admin.locator('[data-home-wall-settings]').waitFor();
        await shot(page, `wall-${size}-${scheme}`);
        await tab('סיווג מפסקים');
        await admin.locator('[data-sw-row]').first().waitFor({ state: 'attached' });
        try { await admin.locator('[data-sw-all]').check({ timeout: 3000 }); } catch { /* not offered at this width: the plain list is captured */ }
        await shot(page, `switches-${size}-${scheme}`);
      });
    }
  }
});
