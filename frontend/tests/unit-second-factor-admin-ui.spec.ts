import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// K11 gap closure (2.2.0 follow-up): the two administrator surfaces of the optional second factor, against a MOCKED wire
// contract of smplwise/routers/second_factor.py and settings (invented users, no secrets):
//   1. users and access > the user drawer: the "second factor" row shows on / off, the reset needs a second click
//      (confirmation text, cancel keeps the factor) and calls DELETE auth/second-factor/users/{id};
//   2. settings > remote access: the policy select (optional / admins) saves security.second_factor_policy through PATCH settings.
// The end-to-end sign-in with the real backend is evidence-arx-second-factor.spec.ts (fixture backend).
//   SW_BASE_URL=http://127.0.0.1:5262/ npx playwright test tests/unit-second-factor-admin-ui.spec.ts --workers=1

// SW_SHOTS=1 also writes element screenshots for the Hebrew user guide to docs/design/evidence/tfa2 (nothing otherwise).
const SHOTS_OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tfa2');
async function guideShot(loc: Locator | Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(SHOTS_OUT, { recursive: true });
  await loc.screenshot({ path: path.join(SHOTS_OUT, `${name}-${test.info().project.name}.png`) });
}

const PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const notFound = (route: Route) => json(route, { code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: 'mock', details: {} }, 404);

interface Mock {
  calls: { method: string; path: string; body: unknown }[];
  enrolled: Set<string>;
  settings: Record<string, unknown>;
  overrides: { user: Record<string, string>; role: Record<string, string> };
}

const user = (id: string, name: string, username: string, isSelf = false) => ({
  id, name, username, is_admin: isSelf, active: true, source: 'both', sync_status: 'verified', synced_at: '2026-10-06T08:00:00Z', first_seen_at: null, last_seen_at: null,
  groups: [], bindings: [], is_self: isSelf, remote_access: true, remote_access_basis: 'flag', remote_last_sign_in: null, remote_sessions: 0,
});

async function setup(page: Page): Promise<Mock> {
  const st: Mock = { calls: [], overrides: { user: {}, role: {} }, enrolled: new Set(['u-dana']), settings: { 'ui.design': 'a', 'security.second_factor_policy': 'optional', 'remote.policy': 'flag' } };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings' && method === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>;
      st.calls.push({ method, path: p, body });
      st.settings = { ...st.settings, ...body };
      return json(route, { settings: st.settings, can_edit: true });
    }
    if (p === 'settings') return json(route, { settings: st.settings, can_edit: true });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-10-06T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'identity/users') return json(route, { users: [user('u-admin', 'מנהל', 'admin', true), user('u-dana', 'דנה כהן', 'dana'), user('u-ron', 'רון לוי', 'ron')], directory: { paired: true, last_directory_at: null, users: 3 }, revision: 1, can_assign: true, remote_policy: 'flag' });
    if (p === 'access/roles') return json(route, { roles: [], labels: {}, sensitive: [] });
    if (p === 'access/groups') return json(route, { groups: [], can_manage: true, delegated: false });
    if (p === 'auth/sessions') return json(route, { scope: 'all', can_manage: true, channel: 'local', sessions: [] });
    if (p === 'auth/second-factor/users' && method === 'GET') {
      return json(route, { policy: st.settings['security.second_factor_policy'], users: [...st.enrolled].map((id) => ({ user_id: id, enabled_at: '2026-10-05T09:00:00Z', last_used_at: null })) });
    }
    if (p === 'auth/second-factor/overrides' && method === 'GET') return json(route, { policy: st.settings['security.second_factor_policy'], ...st.overrides });
    const ov = p.match(/^auth\/second-factor\/overrides\/(user|role)\/(.+)$/);
    if (ov && method === 'PUT') {
      const kind = ov[1] as 'user' | 'role';
      const id = decodeURIComponent(ov[2]);
      const body = req.postDataJSON() as { policy: string };
      st.calls.push({ method, path: p, body });
      if (body.policy === 'inherit') delete st.overrides[kind][id];
      else st.overrides[kind][id] = body.policy;
      return json(route, { kind, subject_id: id, policy: body.policy, ...st.overrides });
    }
    const del = p.match(/^auth\/second-factor\/users\/(.+)$/);
    if (del && method === 'DELETE') {
      const id = decodeURIComponent(del[1]);
      st.calls.push({ method, path: p, body: null });
      const removed = st.enrolled.delete(id);
      return json(route, { user_id: id, removed });
    }
    return notFound(route);
  });
  return st;
}

async function openUser(page: Page, name: string) {
  await page.goto('/?design=a#/system/access');
  await page.waitForSelector('sw-app system-access');
  const screen = page.locator('sw-app system-access');
  await screen.locator('sw-table tbody tr', { hasText: name }).first().click();
  const drawer = screen.locator('sw-drawer');
  await expect(drawer).toBeVisible();
  return drawer;
}

test('user drawer: the reset button asks first, cancel keeps the factor, confirm resets it for that user only', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await setup(page);
  const drawer = await openUser(page, 'דנה כהן');
  const row = drawer.locator('[data-second-factor-user]');
  await expect(row.locator('[data-sf-admin-state]')).toContainText('פעיל');
  await expect(row.locator('[data-sf-admin-confirm]')).toHaveCount(0);

  // first click only arms: the confirmation text and the confirm button show, nothing was sent
  await row.locator('[data-sf-admin-reset]').click();
  await expect(row.locator('[data-sf-admin-confirm]')).toBeVisible();
  expect(mock.calls.filter((c) => c.method === 'DELETE')).toEqual([]);

  // cancel disarms and keeps the factor
  await row.getByRole('button', { name: 'ביטול' }).click();
  await expect(row.locator('[data-sf-admin-confirm]')).toHaveCount(0);
  await expect(row.locator('[data-sf-admin-state]')).toContainText('פעיל');
  expect(mock.enrolled.has('u-dana')).toBe(true);

  // confirm: the right user id goes to the right route and the row turns into the done message
  await row.locator('[data-sf-admin-reset]').click();
  await row.locator('[data-sf-admin-confirm]').click();
  await expect(row.locator('[data-sf-message]')).toBeVisible();
  expect(mock.calls.filter((c) => c.method === 'DELETE')).toEqual([{ method: 'DELETE', path: 'auth/second-factor/users/u-dana', body: null }]);
  expect(mock.enrolled.has('u-dana')).toBe(false);

  // a user without a factor shows "off" and no reset button
  await page.getByRole('button', { name: 'סגור' }).click();
  await page.locator('sw-app system-access sw-table tbody tr', { hasText: 'רון לוי' }).first().click();
  const other = page.locator('sw-app system-access sw-drawer [data-second-factor-user]');
  await expect(other.locator('[data-sf-admin-state]')).toBeVisible();
  await expect(other.locator('[data-sf-admin-reset]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('user drawer: a failed reset shows the error and keeps the factor on screen', async ({ page }) => {
  const mock = await setup(page);
  await page.route('**/api/v1/auth/second-factor/users/*', (route) => (route.request().method() === 'DELETE' ? json(route, { code: 'forbidden', user_message: 'אין הרשאה לאפס אימות דו־שלבי.', retryable: false, correlation_id: 'mock', details: {} }, 403) : route.fallback()));
  const drawer = await openUser(page, 'דנה כהן');
  const row = drawer.locator('[data-second-factor-user]');
  await row.locator('[data-sf-admin-reset]').click();
  await row.locator('[data-sf-admin-confirm]').click();
  await expect(row.locator('[role="alert"]')).toContainText('אין הרשאה');
  await expect(row.locator('[data-sf-admin-state]')).toContainText('פעיל');
  expect(mock.enrolled.has('u-dana')).toBe(true);
});

test('remote-access settings: the policy select offers optional and admins, shows the stored value and saves it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await setup(page);
  await page.goto('/?design=a#/system/diagnostics?tab=remote');
  await page.waitForSelector('sw-app system-diagnostics');
  const row = page.locator('system-diagnostics [data-second-factor-policy-row]');
  await expect(row).toBeVisible();
  const select = row.locator('select[data-set-remote="security.second_factor_policy"]');
  await expect(select.locator('option')).toHaveCount(2);
  await expect(select).toHaveValue('optional');
  await expect(select).toBeEnabled();
  const save = page.locator('system-diagnostics [data-save-remote]');
  await expect(save).toHaveAttribute('disabled', '');

  await select.selectOption('admins');
  await expect(save).not.toHaveAttribute('disabled', '');
  await save.click();
  await expect(page.locator('system-diagnostics .foot .ok')).toBeVisible();
  expect(mock.calls.filter((c) => c.method === 'PATCH')).toEqual([{ method: 'PATCH', path: 'settings', body: { 'security.second_factor_policy': 'admins' } }]);

  // a reload shows what was stored
  await page.reload();
  await page.waitForSelector('sw-app system-diagnostics');
  await expect(page.locator('system-diagnostics [data-second-factor-policy-row] select')).toHaveValue('admins');
  expect(errors).toEqual([]);
});

test('user drawer: the policy override select offers inherit / optional / required and saves the right user', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await setup(page);
  mock.overrides.user['u-ron'] = 'required';
  const drawer = await openUser(page, 'דנה כהן');
  const select = drawer.locator('[data-second-factor-policy-user] select[data-sf-policy-select]');
  await expect(select.locator('option')).toHaveCount(3);
  await expect(select).toHaveValue('inherit');
  await select.selectOption('required');
  await expect(select).toHaveValue('required');
  await guideShot(page, 'tfa2-user-policy'); // SW_SHOTS only
  expect(mock.calls.filter((c) => c.method === 'PUT')).toEqual([{ method: 'PUT', path: 'auth/second-factor/overrides/user/u-dana', body: { policy: 'required' } }]);
  expect(mock.overrides.user['u-dana']).toBe('required');
  // another user shows their own stored value, not the previous user's
  await page.getByRole('button', { name: 'סגור' }).click();
  await page.locator('sw-app system-access sw-table tbody tr', { hasText: 'רון לוי' }).first().click();
  await expect(page.locator('sw-app system-access sw-drawer [data-second-factor-policy-user] select')).toHaveValue('required');
  await page.locator('sw-app system-access sw-drawer [data-second-factor-policy-user] select').selectOption('inherit');
  await expect.poll(() => mock.overrides.user['u-ron']).toBeUndefined();
  expect(errors).toEqual([]);
});

test('user drawer: a refused override shows the error and keeps the old value', async ({ page }) => {
  const mock = await setup(page);
  await page.route('**/api/v1/auth/second-factor/overrides/**', (route) => (route.request().method() === 'PUT' ? json(route, { code: 'forbidden', user_message: 'אין הרשאה לשנות מדיניות.', retryable: false, correlation_id: 'mock', details: {} }, 403) : route.fallback()));
  const drawer = await openUser(page, 'דנה כהן');
  const select = drawer.locator('[data-second-factor-policy-user] select');
  await select.selectOption('required');
  await expect(drawer.locator('[data-sf-policy-error]')).toContainText('אין הרשאה');
  await expect(select).toHaveValue('inherit');
  expect(mock.overrides.user).toEqual({});
});

test('roles screen: every role card has the policy override select', async ({ page }) => {
  const mock = await setup(page);
  const role = (id: string, name: string, custom: boolean) => ({ id, name, description: '', permissions: ['video.live'], sensitive_missing: [], custom, system_role: false, delegable: false, delegation_block: null, revision: 1 });
  await page.route('**/api/v1/access/roles', (route) => json(route, { roles: [role('viewer', 'צופה', false), role('custom-1', 'שומר', true)], labels: { 'video.live': 'וידאו חי' }, sensitive: [], can_manage_roles: true, delegable_roles: [] }));
  mock.overrides.role['custom-1'] = 'required';
  await page.goto('/?design=a#/system/access');
  await page.waitForSelector('sw-app system-access');
  const screen = page.locator('sw-app system-access');
  await screen.locator('sw-tabs').getByText('תפקידים').click();
  const viewer = screen.locator('[data-role-card="viewer"] select[data-sf-policy-select]');
  const custom = screen.locator('[data-role-card="custom-1"] select[data-sf-policy-select]');
  await expect(viewer).toHaveValue('inherit');
  await expect(custom).toHaveValue('required');
  await guideShot(screen.locator('[data-role-card="custom-1"]'), 'tfa2-role-policy'); // SW_SHOTS only
  await viewer.selectOption('optional');
  await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT').length).toBe(1);
  expect(mock.calls.filter((c) => c.method === 'PUT')).toEqual([{ method: 'PUT', path: 'auth/second-factor/overrides/role/viewer', body: { policy: 'optional' } }]);
});

test('remote-access settings: no infrastructure-coverage note under the second-factor policy (owner 2026-10-09: removed, it does not matter to users)', async ({ page }) => {
  await setup(page);
  await page.goto('/?design=a#/system/diagnostics?tab=remote');
  await page.waitForSelector('sw-app system-diagnostics');
  await expect(page.locator('system-diagnostics [data-second-factor-policy-row]')).toBeVisible();
  await expect(page.locator('system-diagnostics [data-second-factor-infra-note]')).toHaveCount(0);
  await expect(page.locator('system-diagnostics')).not.toContainText('ולא על הכניסה של תשתית המערכת');
});
