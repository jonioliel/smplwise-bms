import { test, expect, type Page, type Route } from '@playwright/test';

// LOWS-FRONTEND-2550: page behaviour of three low findings of the 2.52 deep review, against a MOCKED backend (invented users, no secrets):
//   SCR-44  my account > passkeys: a removal waiting for its step-up confirmation is dropped by the row's own "cancel"
//   SCR-47  settings > backups: an installation with no backups shows "no backups yet" (it showed "the backup list did not load")
//   SCR-49  users and permissions: revoking a user's role asks first, naming it; cancel sends nothing
// A page spec (the built app, or the Vite dev server):
//   SW_UNIT_PAGES=1 SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test -c playwright.unit.config.ts tests/unit-lows-frontend-2550-pages.spec.ts --workers=1
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (code: string, msg: string, details: Record<string, unknown> = {}) => ({ code, user_message: msg, retryable: false, correlation_id: 'mock', details });
const ADMIN = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'events.read', 'system.configure', 'rbac.assign', 'backup.manage'];
const ME = (perms: string[]) => ({
  user: { id: 'u-admin', username: 'admin', display_name: 'מנהלת', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [],
  permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false,
  bootstrap_state: 'done', mode: 'full',
});

/** The shell's own reads; `own` answers the spec's routes first (return true when answered). */
async function mockApp(page: Page, perms: string[], own: (p: string, method: string, route: Route) => Promise<boolean> | boolean) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (await own(p, method, route)) return;
    if (p === 'me') return json(route, ME(perms));
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'time.zone': 'Asia/Jerusalem' }, can_edit: true, nvr_channels: 16, warnings: [] });
    if (p === 'health') return json(route, { status: 'ok', version: 'test', mode: 'full' });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-26T08:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    return json(route, err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
}

test.describe('LOWS-FRONTEND-2550 pages', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'mobile' || info.project.name === 'tablet', 'behaviour, not layout: one viewport');
  });

  test('SCR-44: the row cancel drops the removal waiting for its confirmation; nothing is removed', async ({ page }) => {
    const calls: string[] = [];
    let creds = [{ id: 'pk_1', label: 'מפתח בדיקה' }];
    await mockApp(page, ['video.live', 'devices.read'], (p, method, route) => {
      if (p === 'auth/sessions') return json(route, { scope: 'own', can_manage: false, channel: 'local', sessions: [] }).then(() => true);
      if (p === 'auth/second-factor' && method === 'GET') return json(route, { enabled: true, enabled_at: '2026-11-01T09:00:00Z', last_used_at: null, policy: 'optional' }).then(() => true);
      if (p === 'auth/passkeys' && method === 'GET') {
        return json(route, {
          available: true, rp_id: 'localhost', origin: new URL(route.request().url()).origin, first_allowed: false, first_on: false, only_on: false, only_effective: false,
          credentials: creds.map((c) => ({ ...c, created_at: '2026-11-24T08:00:00+00:00', last_used_at: null, synced: true, backed_up: true, transports: ['internal'], usable: true, user_verifying: true })),
          recent_auth: false, recent_auth_left_s: 0, totp: true, user_kind: 'user',
        }).then(() => true);
      }
      if (/^auth\/passkeys\/pk_\d+$/.test(p) && method === 'DELETE') {
        calls.push(`${method} ${p}`);
        return json(route, err('step_up_required', 'צריך לאשר שוב את הזהות.', { action: 'auth.passkey.remove', methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' }), 403).then(() => true);
      }
      if (p === 'auth/step-up/verify') {
        calls.push(`${method} ${p}`);
        creds = [];
        return json(route, { method: 'totp', minutes: 5, valid_until: '2026-11-26T10:05:00+00:00' }).then(() => true);
      }
      return false;
    });
    await page.goto('/?design=a#/live/cameras');
    await page.waitForSelector('sw-app');
    await page.locator('sw-app [data-profile-menu]').click();
    const menu = page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
    await expect(menu).toBeVisible();
    await menu.locator('[data-menu-account]').click();
    await menu.locator('[data-my-second-factor] summary').click();
    const section = menu.locator('[data-my-second-factor] sw-passkeys');
    await expect(section.locator('[data-pk-item]')).toHaveCount(1);
    await section.locator('[data-pk-remove]').click();
    await section.locator('[data-pk-remove-confirm]').click();
    await expect(section.locator('[data-pk-step-up]')).toBeVisible(); // the removal waits for the confirmation
    // the ROW's cancel (not the confirmation box's): the waiting removal goes with it
    await section.locator('[data-pk-item="pk_1"] .actions sw-button').nth(1).click(); // the row's cancel (data-pk-remove-cancel on the branch)
    await expect(section.locator('[data-pk-step-up]')).toHaveCount(0);
    await expect(section.locator('[data-pk-item]')).toHaveCount(1);
    expect(calls).toEqual(['DELETE auth/passkeys/pk_1']); // the one refused attempt; no proof, no second DELETE
  });

  test('SCR-47: no backups yet is the empty state, not "the backup list did not load"', async ({ page }) => {
    await mockApp(page, ADMIN, (p, method, route) => {
      if (p === 'backups' && method === 'GET') return json(route, { backups: [], policy: { 'auto-pre-upgrade': 5, 'auto-daily': 7 }, bytes: 0, schema_version: 1 }).then(() => true);
      return false;
    });
    await page.goto('/?design=a&look=performance:full#/system/diagnostics?tab=backup');
    await page.waitForSelector('sw-app system-diagnostics');
    const d = page.locator('sw-app system-diagnostics');
    await expect(d.locator('sw-state-panel[state="empty"]', { hasText: 'עדיין אין גיבויים' })).toBeVisible({ timeout: 15_000 });
    await expect(d.locator('sw-state-panel[state="error"]', { hasText: 'רשימת הגיבויים לא נטענה' })).toHaveCount(0);
  });

  test('SCR-47: a failed backup list read still shows the error panel', async ({ page }) => {
    await mockApp(page, ADMIN, (p, method, route) => {
      if (p === 'backups' && method === 'GET') return json(route, err('backup_failed', 'קריאת הגיבויים נכשלה (בדיקה)'), 500).then(() => true);
      return false;
    });
    await page.goto('/?design=a&look=performance:full#/system/diagnostics?tab=backup');
    await page.waitForSelector('sw-app system-diagnostics');
    await expect(page.locator('sw-app system-diagnostics sw-state-panel[state="error"]', { hasText: 'רשימת הגיבויים לא נטענה' })).toBeVisible({ timeout: 15_000 });
  });

  test('SCR-49: revoking a user role asks first, naming it; cancel sends nothing, confirm revokes', async ({ page }) => {
    const deletes: string[] = [];
    const binding = {
      id: 'bnd-1', subject_kind: 'user', subject_id: 'u-dana', subject_name: 'דנה כהן', role_id: 'operator', role_name: 'מפעיל', scope_type: 'installation', scope_id: '*',
      scope_name: 'כל ההתקנה', effect: 'allow', permission_revision: 3, assigned_by: 'u-admin', created_at: '2026-11-01T08:00:00Z', expires_at: null, via_group: null,
    };
    let bound = true;
    const user = (id: string, name: string, username: string, isSelf = false) => ({
      id, name, username, is_admin: isSelf, active: true, source: 'both', sync_status: 'verified', synced_at: '2026-11-01T08:00:00Z', first_seen_at: null, last_seen_at: null,
      groups: [], bindings: id === 'u-dana' && bound ? [binding] : [], is_self: isSelf, remote_access: true, remote_access_basis: 'flag', remote_last_sign_in: null, remote_sessions: 0,
    });
    await mockApp(page, ADMIN, (p, method, route) => {
      if (p === 'identity/users') return json(route, { users: [user('u-admin', 'מנהלת', 'admin', true), user('u-dana', 'דנה כהן', 'dana')], directory: { paired: true, last_directory_at: null, users: 2 }, revision: 1, can_assign: true, remote_policy: 'flag' }).then(() => true);
      if (p === 'access/roles') return json(route, { roles: [], labels: {}, sensitive: [] }).then(() => true);
      if (p === 'access/groups') return json(route, { groups: [], can_manage: true, delegated: false }).then(() => true);
      if (p === 'auth/sessions') return json(route, { scope: 'all', can_manage: true, channel: 'local', sessions: [] }).then(() => true);
      if (p === 'auth/second-factor/users' && method === 'GET') return json(route, { policy: 'optional', users: [] }).then(() => true);
      if (p === 'auth/second-factor/overrides' && method === 'GET') return json(route, { policy: 'optional', user: {}, role: {} }).then(() => true);
      if (p === 'access/bindings/bnd-1' && method === 'DELETE') {
        deletes.push(p);
        bound = false;
        return json(route, { ok: true, revision: 4 }).then(() => true);
      }
      return false;
    });
    await page.goto('/?design=a#/system/access');
    await page.waitForSelector('sw-app system-access');
    const screen = page.locator('sw-app system-access');
    await screen.locator('sw-table tbody tr', { hasText: 'דנה כהן' }).first().click();
    const drawer = screen.locator('sw-drawer');
    await expect(drawer.locator('[data-binding="bnd-1"]')).toBeVisible();
    await drawer.locator('[data-binding="bnd-1"] [data-revoke]').click();
    const text = page.locator('[data-confirm-text]');
    await expect(text).toContainText('מפעיל · כל ההתקנה');
    await expect(text).toContainText('דנה כהן');
    await page.locator('[data-confirm-cancel]').click();
    await expect(text).toHaveCount(0);
    expect(deletes).toEqual([]); // cancel: nothing was sent
    await drawer.locator('[data-binding="bnd-1"] [data-revoke]').click();
    await page.locator('[data-confirm-ok]').click();
    await expect.poll(() => deletes).toEqual(['access/bindings/bnd-1']);
  });
});
