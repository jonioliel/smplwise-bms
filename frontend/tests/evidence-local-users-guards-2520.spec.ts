import { test, expect, type Page, type Route } from '@playwright/test';
import { installAccessMock, NOW, url } from './access-control-mocks';

// SCREENS-FIX-A-2520 (SCR-07, deep screens review): Settings > Arx users against a mocked backend (invented people; nothing is sent).
//   1. "disable" asks first (it ends every sign-in and link at once): cancel sends nothing, confirm sends the PATCH once;
//   2. the signed-in person's own row is marked and offers neither disable nor delete (the server refuses both as well);
//   3. a refusal of the server (the last administrator) is shown as the server worded it.
//   npx playwright test tests/evidence-local-users-guards-2520.spec.ts --project=desktop --workers=1

const at = (h: number) => new Date(Date.UTC(2026, 9, 31, h, 15)).toISOString();
const ADMIN_PERMS = ['map.read', 'video.live', 'system.configure', 'rbac.assign', 'audit.read', 'identity.directory.read', 'access.read', 'access.admin.read'];
const user = (id: string, username: string, name: string, admin = false) => ({
  id, username, display_name: name, email: null, notes: null, status: 'active', active: true, created_at: at(1), last_sign_in_at: at(8), last_sign_in_from: null,
  role_id: admin ? 'site_admin' : 'operator', role_name: admin ? 'מנהל אתר' : 'מפעיל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', admin,
  second_factor: admin, reset_mode: 'manager_only', must_change_password: false, sessions: 1, ha_user_id: null,
});
const LOCAL = { enabled: true, can_manage: true, channel: 'local', users: [user('l_01', 'maria', 'מריה כהן'), user('l_02', 'dani', 'דני לוי', true)] };

type St = { patches: { path: string; body: unknown }[]; deletes: string[] };

async function boot(page: Page, o: { me?: string; refuse?: boolean } = {}): Promise<St> {
  const st: St = { patches: [], deletes: [] };
  page.on('dialog', (d) => void d.dismiss());
  await installAccessMock(page, { persona: 'admin' });
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      return json(route, { user: { id: o.me ?? 'u-admin', username: 'admin', display_name: 'מנהלת המערכת', source: o.me ? 'local' : 'ingress' }, channel: 'local', remote: null, bindings: [],
        permissions_installation: ADMIN_PERMS, permissions_any: ADMIN_PERMS, has_access: true, permission_revision: 41, bootstrap_state: 'done' });
    }
    if (p.startsWith('identity/local-users/') && req.method() === 'PATCH') {
      st.patches.push({ path: p, body: req.postDataJSON() });
      if (o.refuse) {
        return json(route, { code: 'last_admin', user_message: 'השינוי משאיר את ההתקנה בלי מנהל מערכת פעיל; הקצה מנהל אחר קודם.', retryable: false, correlation_id: 'mock', details: {} }, 409);
      }
      return json(route, { ...LOCAL.users[1], active: false, status: 'disabled' });
    }
    if (p.startsWith('identity/local-users/') && req.method() === 'DELETE') {
      st.deletes.push(p);
      return route.fulfill({ status: 204 });
    }
    if (p === 'identity/local-users') return json(route, LOCAL);
    if (p === 'identity/users') return json(route, { users: [], directory: { paired: true, last_directory_at: at(9), users: 0 }, revision: 1, can_assign: true, remote_policy: 'flag' });
    if (p === 'access/roles') return json(route, { roles: [{ id: 'operator', name: 'מפעיל', permissions: ['map.read'], sensitive_included: [], sensitive_missing: [], system_role: false, delegable: true }], labels: {}, sensitive: [], system_permissions: [], delegable_roles: ['operator'], can_manage_roles: true, delegated: false });
    if (p === 'access/groups') return json(route, { groups: [], can_manage: true, delegated: false });
    if (p === 'sites') return json(route, { sites: [], can_create_site: true });
    if (p.startsWith('audit')) return json(route, { rows: [] });
    return route.fallback();
  });
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(url('/system/access?tab=local'));
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${LU} [data-local-users]`)).toBeVisible({ timeout: 30_000 });
  return st;
}

const LU = 'sw-app system-access system-local-users';
const DLG = 'sw-confirm-dialog';

test.describe('SCREENS-FIX-A-2520 Arx users: disable asks first, no self removal (SCR-07)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.setTimeout(120_000);
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'desktop', 'one viewport is enough for the behaviour'); });

  test('disable asks first: cancel sends nothing, confirm sends it once', async ({ page }) => {
    const st = await boot(page);
    await page.locator(LU).getByText('דני לוי').first().click();
    await page.locator(`${LU} [data-local-active="disable"]`).click();
    await expect(page.locator(`${DLG} [data-confirm-text]`)).toHaveText('להשבית את דני לוי? כל הכניסות והקישורים שלו מסתיימים מיד.');
    await page.locator(`${DLG} [data-confirm-cancel]`).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    expect(st.patches).toEqual([]);
    await page.locator(`${LU} [data-local-active="disable"]`).click();
    await page.locator(`${DLG} [data-confirm-ok]`).click();
    await expect.poll(() => st.patches).toEqual([{ path: 'identity/local-users/l_02', body: { active: false } }]);
  });

  test('the last administrator: the server\'s refusal is shown as it worded it', async ({ page }) => {
    const st = await boot(page, { refuse: true });
    await page.locator(LU).getByText('דני לוי').first().click();
    await page.locator(`${LU} [data-local-active="disable"]`).click();
    await page.locator(`${DLG} [data-confirm-ok]`).click();
    await expect.poll(() => st.patches.length).toBe(1);
    await expect(page.locator(LU)).toContainText('השינוי משאיר את ההתקנה בלי מנהל מערכת פעיל');
  });

  test('one\'s own row is marked and offers neither disable nor delete', async ({ page }) => {
    const st = await boot(page, { me: 'l_01' });
    await expect(page.locator(`${LU} [data-local-self]`)).toHaveCount(1);
    await page.locator(LU).getByText('מריה כהן').first().click();
    await expect(page.locator(`${LU} [data-local-user="l_01"] [data-local-self-note]`)).toBeVisible();
    await expect(page.locator(`${LU} [data-local-user="l_01"] [data-local-active]`)).toHaveCount(0);
    await expect(page.locator(`${LU} [data-local-user="l_01"] [data-local-remove]`)).toHaveCount(0);
    // another person's row still offers both
    await page.locator(LU).getByText('דני לוי').first().click();
    await expect(page.locator(`${LU} [data-local-user="l_02"] [data-local-active="disable"]`)).toBeVisible();
    await expect(page.locator(`${LU} [data-local-user="l_02"] [data-local-remove]`)).toBeVisible();
    expect(st.patches).toEqual([]);
    expect(st.deletes).toEqual([]);
  });
});
