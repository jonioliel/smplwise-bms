import { test, expect, type Page, type Route } from '@playwright/test';
import { installAccessMock, NOW, url } from './access-control-mocks';

// CR-CONFIRM-DIALOG-2438 (owner Q-SYS-6 / O7 a): the browser's native confirm() box is gone; confirmDialog() opens the system's own
// sw-dialog with the same question. Proven here on the local users screen ("מחיקה" of a user):
//   1. the question is the same text, in the system's dialog, right-to-left, and no native browser dialog opens;
//   2. the confirm button has the focus; Escape cancels, nothing is deleted, the dialog leaves the page;
//   3. the cancel button cancels; the ✕ cancels;
//   4. Enter confirms: the DELETE goes out once.
//   npx playwright test tests/evidence-confirm-dialog-2438.spec.ts --project=desktop --workers=1

const at = (h: number) => new Date(Date.UTC(2026, 9, 31, h, 15)).toISOString();
const ADMIN_PERMS = ['map.read', 'video.live', 'system.configure', 'rbac.assign', 'audit.read', 'identity.directory.read', 'access.read', 'access.admin.read'];
const LOCAL = {
  enabled: true, can_manage: true, channel: 'local',
  users: [
    { id: 'l_01', username: 'maria', display_name: 'מריה כהן', email: null, notes: null, status: 'active', active: true, created_at: at(1), last_sign_in_at: at(8), last_sign_in_from: null, role_id: 'operator', role_name: 'מפעיל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', admin: false, second_factor: false, reset_mode: 'manager_only', must_change_password: false, sessions: 0, ha_user_id: null },
  ],
};

async function boot(page: Page): Promise<{ deletes: string[]; nativeDialogs: number }> {
  const st = { deletes: [] as string[], nativeDialogs: 0 };
  page.on('dialog', (d) => {
    st.nativeDialogs += 1;
    void d.dismiss();
  });
  await installAccessMock(page, { persona: 'admin' });
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהלת המערכת', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: ADMIN_PERMS, permissions_any: ADMIN_PERMS, has_access: true, permission_revision: 41, bootstrap_state: 'done' });
    }
    if (p.startsWith('identity/local-users/') && req.method() === 'DELETE') {
      st.deletes.push(p);
      return route.fulfill({ status: 204 });
    }
    if (p === 'identity/local-users') return json(route, LOCAL);
    // the rest of the access screen, minimal (the users tab is not under test)
    if (p === 'identity/users') return json(route, { users: [], directory: { paired: true, last_directory_at: at(9), users: 0 }, revision: 1, can_assign: true, remote_policy: 'flag' });
    if (p === 'access/roles') return json(route, { roles: [{ id: 'operator', name: 'מפעיל', permissions: ['map.read'], sensitive_included: [], sensitive_missing: [], system_role: false, delegable: true }, { id: 'viewer', name: 'צופה', permissions: ['map.read'], sensitive_included: [], sensitive_missing: [], system_role: false, delegable: true }], labels: {}, sensitive: [], system_permissions: [], delegable_roles: ['viewer', 'operator'], can_manage_roles: true, delegated: false });
    if (p === 'access/groups') return json(route, { groups: [], can_manage: true, delegated: false });
    if (p === 'sites') return json(route, { sites: [], can_create_site: true });
    if (p.startsWith('audit')) return json(route, { rows: [] });
    return route.fallback();
  });
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(url('/system/access?tab=local'));
  await page.waitForSelector('sw-app');
  return st;
}

const LU = 'sw-app system-access system-local-users';
const DLG = 'sw-confirm-dialog';

async function ask(page: Page) {
  await page.locator(`${LU} sw-button.end[variant="danger"]`).click();
  await expect(page.locator(`${DLG} [data-confirm-text]`)).toBeVisible();
}

test.describe('the system confirmation dialog replaces confirm() (CR-CONFIRM-DIALOG-2438)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.setTimeout(120_000);

  test('same question, system dialog, keyboard and focus as the native box', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one viewport is enough for the behaviour');
    const st = await boot(page);
    await expect(page.locator(`${LU} [data-local-users]`)).toBeVisible({ timeout: 30_000 });
    await page.locator(LU).getByText('מריה כהן').first().click();

    // 1. the same text, in sw-dialog, right-to-left
    await ask(page);
    await expect(page.locator(`${DLG} [data-confirm-text]`)).toHaveText('למחוק את מריה כהן? הכניסות, הקישורים והתפקיד מסתיימים מיד.');
    await expect(page.locator(`${DLG} sw-dialog[data-confirm-dialog]`)).toHaveAttribute('open', '');
    await expect(page.locator(`${DLG} [role="dialog"]`)).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator(`${DLG} [data-confirm-ok]`)).toHaveText('אישור');
    await expect(page.locator(`${DLG} [data-confirm-ok]`)).toHaveAttribute('variant', 'danger');
    await expect(page.locator(`${DLG} [data-confirm-cancel]`)).toHaveText('ביטול');
    expect(await page.locator(`${DLG} [data-confirm-text]`).evaluate((el) => getComputedStyle(el).direction)).toBe('rtl');

    // 2. the confirm button has the focus; Escape cancels
    await expect.poll(() => page.evaluate(() => {
      let a: Element | null = document.activeElement;
      while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
      return (a?.getRootNode() as ShadowRoot | undefined)?.host?.hasAttribute('data-confirm-ok') ?? false;
    })).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator(DLG)).toHaveCount(0);
    expect(st.deletes).toEqual([]);

    // 3. the cancel button and the ✕ cancel
    await ask(page);
    await page.locator(`${DLG} [data-confirm-cancel]`).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    await ask(page);
    await page.locator(`${DLG} sw-dialog sw-button[icon="close"]`).click();
    await expect(page.locator(DLG)).toHaveCount(0);
    expect(st.deletes).toEqual([]);

    // 4. Enter confirms - once
    await ask(page);
    await expect.poll(() => page.evaluate(() => {
      let a: Element | null = document.activeElement;
      while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
      return (a?.getRootNode() as ShadowRoot | undefined)?.host?.hasAttribute('data-confirm-ok') ?? false;
    })).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.locator(DLG)).toHaveCount(0);
    await expect.poll(() => st.deletes).toEqual(['identity/local-users/l_01']);
    expect(st.nativeDialogs).toBe(0);
  });
});
