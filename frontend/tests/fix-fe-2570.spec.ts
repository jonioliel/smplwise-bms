import { expect, test, type Page, type Route } from '@playwright/test';
import { mockHome } from './home-simple-mocks';

// FIX-FE-2570 (deep review 2.56, FE-02): the home administration page saves each switch at once. A refused or failed save must leave the
// switch on the server's state (it is a `controlled` sw-toggle: a press only asks), never on the value the server refused.
// Mocked backend (tests/home-simple-mocks.ts); nothing is sent anywhere.

const ok = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const refused = (r: Route) => ok(r, { detail: { code: 'forbidden', message: 'refused' } }, 403);
const state = (sw: ReturnType<Page['locator']>) => sw.locator('button[role="switch"]');

async function admin(page: Page) {
  await mockHome(page, { perms: ['devices.read', 'rbac.assign', 'system.configure', 'identity.directory.read'], policy: { interface: 'full', default_interface: 'full', admin: true } });
  // the signed-in person (dev-noa, tests/home-simple-mocks.ts) is a system administrator - she may change the visitor switch; the person
  // shown first (dev-dan) is not, so his per-person switches are enabled (a system administrator's "home only" is locked)
  const row = { source: 'ingress', default_interface: 'full', may_switch: true, home_only: false, kiosk: false, kiosk_area_id: null, rooms: null, modules: ['lights', 'doors'], configured: true, guests: false, can_invite: false };
  const users = [
    { ...row, user_id: 'dev-dan', username: 'dan', display_name: 'דן כהן', system_admin: false, admin: false },
    { ...row, user_id: 'dev-noa', username: 'noa', display_name: 'נועה לביא', system_admin: true, admin: true },
  ];
  const sent: { path: string; body: unknown }[] = [];
  const settings = { default_mode: 'full_all', kiosk_exit: 'code', wallpaper: 'none', wall_rest: 'off', wall_rest_after: '2', wall_night: 'off', wall_night_start: '23:00', wall_night_end: '06:00', wall_night_dim: 'medium', wall_takeover: 'alarm_urgent' };
  await page.route('**/api/v1/home/policies', (r) => ok(r, { users, modules: ['lights', 'doors'], seed: {}, kiosk_code_set: false }));
  await page.route('**/api/v1/home/policies/*', (r) => { sent.push({ path: 'home/policies', body: r.request().postDataJSON() }); return refused(r); });
  await page.route('**/api/v1/home/settings', (r) => {
    if (r.request().method() === 'PUT') { sent.push({ path: 'home/settings', body: r.request().postDataJSON() }); return ok(r, { detail: 'boom' }, 500); }
    return ok(r, { settings, values: {}, gallery: [] });
  });
  await page.route('**/api/v1/home/room-wallpapers', (r) => ok(r, { walls: {}, mode: 'none', gallery: [] }));
  await page.route('**/api/v1/access/visitors/settings', (r) => {
    if (r.request().method() === 'PUT') { sent.push({ path: 'visitors', body: r.request().postDataJSON() }); return refused(r); }
    return ok(r, { visitors: 'off', effective: false, external_grants: 'on' });
  });
  await page.route('**/api/v1/identity/users**', (r) => ok(r, { users: [], directory: { paired: false, users: 0, last_directory_at: null }, revision: 1, delegated: false }));
  await page.route('**/api/v1/access/roles**', (r) => ok(r, { roles: [] }));
  await page.route('**/api/v1/access/groups**', (r) => ok(r, { groups: [], can_manage: true }));
  await page.route('**/api/v1/sites?tree=true', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/#/system/access?tab=home');
  const el = page.locator('sw-home-admin');
  await expect(el.locator('[data-home-detail] h3')).toHaveText('דן כהן', { timeout: 30_000 });
  return { el, sent };
}

test.describe('FIX-FE-2570 FE-02 the home administration switches after a refused save', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one size is enough');
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('a per-person policy switch ("home only", "guests") stays off when the save is refused', async ({ page }) => {
    const { el, sent } = await admin(page);
    for (const sel of ['sw-toggle[label="ממשק ביתי בלבד"]', 'sw-toggle[data-home-guests]']) {
      const sw = el.locator(sel);
      await expect(state(sw), sel).toHaveAttribute('aria-checked', 'false');
      const before = sent.length;
      await sw.click();
      await expect.poll(() => sent.length, sel).toBe(before + 1);
      await expect(el.locator('.msg.err'), sel).toBeVisible();
      await expect(state(sw), sel).toHaveAttribute('aria-checked', 'false');
    }
    expect(sent.map((s) => JSON.stringify(s.body))).toEqual(['{"home_only":true}', '{"guests":true}']);
  });

  test('the visitor-invitation switch and the wall-panel rest / night switches stay off when the save fails', async ({ page }) => {
    const { el, sent } = await admin(page);
    await el.locator('[data-home-subtabs] [role="tab"]', { hasText: 'הגדרות התקנה' }).click();
    const vis = el.locator('sw-toggle[data-home-visitors-switch]');
    await expect(state(vis)).toHaveAttribute('aria-checked', 'false');
    await vis.click();
    await expect.poll(() => sent.filter((s) => s.path === 'visitors').map((s) => JSON.stringify(s.body))).toEqual(['{"visitors":"on"}']);
    await expect(state(vis)).toHaveAttribute('aria-checked', 'false');

    await el.locator('[data-home-subtabs] [role="tab"]', { hasText: 'מסכי קיר' }).click();
    for (const key of ['data-wall-rest-toggle', 'data-wall-night-toggle']) {
      const sw = el.locator(`[${key}]`);
      await expect(state(sw), key).toHaveAttribute('aria-checked', 'false');
      const before = sent.length;
      await sw.click();
      await expect.poll(() => sent.length, key).toBe(before + 1);
      await expect(state(sw), key).toHaveAttribute('aria-checked', 'false');
    }
    expect(sent.filter((s) => s.path === 'home/settings').map((s) => JSON.stringify(s.body))).toEqual(['{"wall_rest":"on"}', '{"wall_night":"on"}']);
  });
});
