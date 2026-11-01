import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, url } from './access-control-mocks';
import { installParityMock } from './access-parity-mocks';
import { XNOW } from './access-external-mocks';
import { installRequestMock } from './access-request-mocks';
import { installMessagingSettings } from './wiskey-messaging-settings';
import { settlePage } from './pixel-settle';

// ACCESS-POLISH-2331: the people and access administration screens (wave 1) at five widths, before and after the polish pass -
// הגדרות › משתמשים והרשאות (users / groups / roles / effective / audit / Arx users), הגדרות › בקרת כניסה (status / audit / groups /
// policy / messages), the parity and display cards under אבחון, WisKey › גישה חיצונית, and הגדרות › אפליקציה לנייד › מקומות.
// Mocked backend only (invented sample data: no real name, address, number or secret). Besides the screenshots, every capture records
// the page's overflow (sideways scroll of the document / the shell's main area) into metrics.json for the change doc.
//   SW_SHOT_PHASE=before|after SW_BASE_URL=http://127.0.0.1:4203/ npx playwright test tests/evidence-access-polish-2331.spec.ts --workers=2
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHASE = process.env.SW_SHOT_PHASE || 'after';
const OUT = path.resolve(HERE, '..', '..', 'docs', 'evidence', 'ACCESS-POLISH-2331', PHASE);

const VIEWS: Record<string, { name: string; width: number; height: number }[]> = {
  desktop: [{ name: '1440', width: 1440, height: 900 }, { name: '1920', width: 1920, height: 1080 }],
  tablet: [{ name: '1180', width: 1180, height: 820 }, { name: '1024', width: 1024, height: 768 }],
  mobile: [{ name: '390', width: 390, height: 844 }],
};

const views = () => VIEWS[test.info().project.name] ?? VIEWS.desktop;

async function metrics(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main') as HTMLElement | null;
    return {
      mainScroll: main ? main.scrollHeight - main.clientHeight : 0,
      docScroll: document.documentElement.scrollHeight - innerHeight,
      sideways: Math.max(document.documentElement.scrollWidth - innerWidth, main ? main.scrollWidth - main.clientWidth : 0),
    };
  });
}

function record(name: string, m: Record<string, number>) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `metrics-${test.info().project.name}.json`);
  const all = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>) : {};
  all[name] = m;
  fs.writeFileSync(file, `${JSON.stringify(all, null, 1)}\n`);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await settlePage(page, { timeout: 8000 }).catch(() => undefined);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  record(name, await metrics(page));
}

/** Each named view: resize, let the layout settle, shoot. */
async function atViews(page: Page, name: string, before?: () => Promise<void>) {
  for (const v of views()) {
    await page.setViewportSize({ width: v.width, height: v.height });
    if (before) await before();
    await shot(page, `${name}-${v.name}`);
  }
}

// ---------- הגדרות › משתמשים והרשאות (system-access, API mode) ----------

const LABELS: Record<string, string> = {
  'map.read': 'צפייה במפה', 'video.live': 'שידור חי', 'video.playback': 'הקלטות', 'video.export': 'ייצוא וידאו', 'events.read': 'אירועים', 'events.ack': 'אישור אירועים',
  'map.edit': 'עריכת מפה', 'cases.manage': 'תיקים', 'rbac.assign': 'שיוך תפקידים', 'system.configure': 'הגדרות מערכת', 'access.doors.open': 'פתיחת דלתות', 'audit.read': 'אודיט',
};
const SENSITIVE = ['video.export', 'access.doors.open'];
const at = (h: number) => new Date(Date.UTC(2026, 9, 31, h, 15)).toISOString();
const bind = (id: string, role: string, roleName: string, scope: string, scopeName: string, via: string | null = null, effect: 'allow' | 'deny' = 'allow') => ({
  id, subject_kind: 'user', subject_id: 'x', subject_name: '', role_id: role, role_name: roleName, scope_type: scope.split(':')[0], scope_id: scope.split(':')[1], scope_name: scopeName,
  effect, permission_revision: 41, assigned_by: 'u-admin', created_at: at(6), expires_at: null, via_group: via,
});
const user = (id: string, name: string, username: string, o: Record<string, unknown> = {}) => ({
  id, name, username, is_admin: false, active: true, source: 'both', sync_status: 'verified', synced_at: at(9), first_seen_at: at(2), last_seen_at: at(9), groups: [], bindings: [],
  is_self: false, remote_access: false, remote_access_basis: null, remote_admin_default: false, remote_last_sign_in: null, remote_sessions: 0, ...o,
});
const USERS = [
  user('u-admin', 'מנהלת המערכת', 'admin', { is_admin: true, is_self: true, remote_access: true, remote_access_basis: 'admin_default', remote_sessions: 1, remote_last_sign_in: at(8), bindings: [bind('b1', 'system_admin', 'מנהל מערכת', 'installation:*', 'כל ההתקנה')] }),
  user('u-dana', 'דנה לוי', 'dana', { groups: [{ id: 'g1', name: 'עורכי קומה 2' }, { id: 'g2', name: 'צוות לילה' }], bindings: [bind('b2', 'editor', 'עורך', 'floor:f2', 'מבנה א · קומה 2'), bind('b3', 'operator', 'מפעיל', 'site:s1', 'אתר הדגמה', 'צוות לילה')], remote_access: true, remote_sessions: 2, remote_last_sign_in: at(7) }),
  user('u-yossi', 'יוסי כהן', 'yossi', { groups: [{ id: 'g2', name: 'צוות לילה' }], bindings: [bind('b4', 'operator', 'מפעיל', 'site:s1', 'אתר הדגמה', 'צוות לילה')] }),
  user('u-michal', 'מיכל ברק', 'michal.barak', { bindings: [bind('b5', 'viewer', 'צופה', 'building:b1', 'אתר הדגמה · מבנה א'), bind('b6', 'operator', 'מפעיל', 'floor:f3', 'מבנה א · קומה 3', null, 'deny'), bind('b7', 'viewer', 'צופה', 'camera:c1', 'מצלמה · לובי')] }),
  user('u-avi', 'אבי שמש', 'avi', { active: false, sync_status: 'removed' }),
  user('u-noa', 'נועה גל', 'noa', { sync_status: 'stale', groups: [{ id: 'g1', name: 'עורכי קומה 2' }] }),
];
const ROLES = {
  roles: [
    { id: 'viewer', name: 'צופה', permissions: ['map.read', 'video.live', 'events.read'], sensitive_included: [], sensitive_missing: SENSITIVE, system_role: false, delegable: true },
    { id: 'operator', name: 'מפעיל', permissions: ['map.read', 'video.live', 'video.playback', 'events.read', 'events.ack'], sensitive_included: [], sensitive_missing: SENSITIVE, system_role: false, delegable: true },
    { id: 'editor', name: 'עורך', permissions: ['map.read', 'map.edit'], sensitive_included: [], sensitive_missing: SENSITIVE, system_role: false },
    { id: 'site_admin', name: 'מנהל אתר', permissions: ['map.read', 'rbac.assign', 'events.read'], sensitive_included: [], sensitive_missing: SENSITIVE, system_role: false, delegation_block: 'assign_role' },
    { id: 'system_admin', name: 'מנהל מערכת', permissions: Object.keys(LABELS), sensitive_included: SENSITIVE, sensitive_missing: [], system_role: true, delegation_block: 'system_role' },
    { id: 'r-guard', name: 'שומר לילה', custom: true, description: 'שידור חי ופתיחת דלת הלובי בלילה', revision: 3, permissions: ['map.read', 'video.live', 'access.doors.open'], sensitive_included: ['access.doors.open'], sensitive_missing: ['video.export'], system_role: false, delegation_block: 'sensitive' },
  ],
  labels: LABELS, sensitive: SENSITIVE, system_permissions: ['system.configure', 'audit.read'], delegable_roles: ['viewer', 'operator'], can_manage_roles: true, delegated: false,
};
const GROUPS = {
  groups: [
    { id: 'g1', name: 'עורכי קומה 2', created_at: at(1), revision: 4, members: [{ id: 'u-dana', name: 'דנה לוי' }, { id: 'u-noa', name: 'נועה גל' }], bindings: [{ ...bind('gb1', 'editor', 'עורך', 'floor:f2', 'מבנה א · קומה 2'), subject_kind: 'group', subject_id: 'g1' }] },
    { id: 'g2', name: 'צוות לילה', created_at: at(1), revision: 2, members: [{ id: 'u-dana', name: 'דנה לוי' }, { id: 'u-yossi', name: 'יוסי כהן' }], bindings: [{ ...bind('gb2', 'operator', 'מפעיל', 'site:s1', 'אתר הדגמה'), subject_kind: 'group', subject_id: 'g2' }] },
    { id: 'g3', name: 'קבלנים', created_at: at(1), revision: 1, members: [], bindings: [] },
  ],
  can_manage: true, delegated: false,
};
const AUDIT = Array.from({ length: 14 }, (_, i) => ({
  id: `a${i}`, at: at(10 - (i % 10)), actor_username: i % 4 === 3 ? null : 'admin', action: ['rbac.bind', 'rbac.unbind', 'rbac.group_members', 'identity.sync', 'rbac.role.update'][i % 5],
  decision: i % 6 === 5 ? 'denied' : 'allowed', resource_type: i % 2 ? 'group' : 'user', resource_id: i % 2 ? 'g1' : 'u-dana', reason: i % 6 === 5 ? 'out_of_scope' : null,
  details: { role_id: 'editor', scope: 'floor:f2', added: ['map.edit'], revision: 40 + i },
}));
const TREE = [{ id: 's1', name: 'אתר הדגמה', address: '', timezone: 'Asia/Jerusalem', sort_order: 0, updated_at: '', buildings: [{ id: 'b1', site_id: 's1', name: 'מבנה א', sort_order: 0, updated_at: '', floors: [
  { id: 'f2', building_id: 'b1', name: 'קומה 2', level: 2, sort_order: 0, ha_area_id: null, has_plan: false, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, updated_at: '' },
  { id: 'f3', building_id: 'b1', name: 'קומה 3', level: 3, sort_order: 1, ha_area_id: null, has_plan: false, published_version_id: null, plan_width_px: null, plan_height_px: null, draft_version_id: null, anchor_count: 0, updated_at: '' },
] }] }];
const LOCAL = {
  enabled: true, can_manage: true, channel: 'local',
  users: [
    { id: 'l_01', username: 'maria', display_name: 'מריה כהן', email: null, notes: null, status: 'active', active: true, created_at: at(1), last_sign_in_at: at(8), last_sign_in_from: '203.0.113.0/24 IL', role_id: 'operator', role_name: 'מפעיל', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', admin: false, second_factor: true, reset_mode: 'manager_only', must_change_password: false, sessions: 2, ha_user_id: null },
    { id: 'l_02', username: 'site.lead', display_name: 'אבי לוי', email: null, notes: 'ניהול אתר', status: 'pending_first_login', active: true, created_at: at(2), last_sign_in_at: null, last_sign_in_from: null, role_id: 'site_admin', role_name: 'מנהל אתר', scope_type: 'site', scope_id: 's1', scope_name: 'אתר הדגמה', admin: true, second_factor: false, reset_mode: 'manager_only', must_change_password: false, sessions: 0, ha_user_id: null },
    { id: 'l_03', username: 'cleaner1', display_name: 'צוות ניקיון', email: null, notes: null, status: 'delayed', active: true, created_at: at(3), last_sign_in_at: at(5), last_sign_in_from: null, role_id: 'viewer', role_name: 'צופה', scope_type: 'floor', scope_id: 'f2', scope_name: 'קומה 2', admin: false, second_factor: false, reset_mode: 'self_service', must_change_password: false, sessions: 0, ha_user_id: null },
  ],
};
const ADMIN_PERMS = ['map.read', 'video.live', 'system.configure', 'rbac.assign', 'audit.read', 'identity.directory.read', 'access.read', 'access.admin.read'];

async function bootPeople(page: Page, hash: string, opts: { users?: unknown[]; forbidden?: boolean } = {}) {
  await installAccessMock(page, { persona: 'admin' });
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהלת המערכת', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: ADMIN_PERMS, permissions_any: ADMIN_PERMS, has_access: true, permission_revision: 41, bootstrap_state: 'done' });
    }
    if (p === 'identity/users') {
      if (opts.forbidden) return json(route, { code: 'forbidden', user_message: 'אין הרשאה (403)', retryable: false, details: {} }, 403);
      return json(route, { users: opts.users ?? USERS, directory: { paired: true, last_directory_at: at(9), users: 6 }, revision: 41, can_assign: true, remote_policy: 'flag' });
    }
    if (p === 'access/roles') return json(route, ROLES);
    if (p === 'access/groups') return json(route, GROUPS);
    if (p === 'sites') return json(route, { sites: TREE, can_create_site: true });
    if (p.startsWith('audit')) return json(route, { rows: AUDIT });
    if (p === 'access/preview') return json(route, { user_id: 'u-dana', scope_type: 'floor', scope_id: 'f2', scope_name: 'מבנה א · קומה 2', active: true, allowed: ['map.read', 'map.edit', 'video.live'], denied: ['video.export', 'access.doors.open', 'system.configure'], labels: LABELS, bindings: USERS[1].bindings, revision: 41 });
    if (p === 'identity/local-users') return json(route, LOCAL);
    return route.fallback();
  });
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(url(hash));
  await page.waitForSelector('sw-app');
}

const ACCESS = 'sw-app system-access';

test.describe('people and access (ACCESS-POLISH-2331)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.setTimeout(180_000);

  test('users: the list and a user drawer', async ({ page }) => {
    await bootPeople(page, '/system/access');
    await expect(page.locator(`${ACCESS} sw-table`)).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'access-users');
    await page.locator(`${ACCESS} sw-table`).getByText('דנה לוי').first().click();
    await expect(page.locator(`${ACCESS} sw-drawer`)).toBeVisible();
    await atViews(page, 'access-user-drawer');
    await page.locator(`${ACCESS} [data-assign]`).click();
    await atViews(page, 'access-user-wizard');
  });

  test('users: forbidden and empty', async ({ page }) => {
    await bootPeople(page, '/system/access', { forbidden: true });
    await expect(page.locator(`${ACCESS} sw-state-panel`)).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'access-forbidden');
    await bootPeople(page, '/system/access', { users: [] });
    await expect(page.locator(`${ACCESS} sw-state-panel`)).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'access-users-empty');
  });

  test('groups', async ({ page }) => {
    await bootPeople(page, '/system/access?tab=groups');
    await expect(page.locator(`${ACCESS} [data-groups-card]`)).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'access-groups');
    await page.locator(`${ACCESS} sw-table`).getByText('עורכי קומה 2').first().click();
    await expect(page.locator(`${ACCESS} [data-group-drawer]`)).toBeVisible();
    await atViews(page, 'access-group-drawer');
  });

  test('roles, effective, audit, Arx users', async ({ page }) => {
    await bootPeople(page, '/system/access?tab=roles');
    await expect(page.locator(`${ACCESS} [data-role-card]`).first()).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'access-roles');
    await page.locator(`${ACCESS} [data-role-new]`).click();
    await expect(page.locator(`${ACCESS} [data-role-dialog] [data-role-name]`)).toBeVisible();
    await atViews(page, 'access-role-dialog');

    await bootPeople(page, '/system/access?tab=effective');
    await expect(page.locator(`${ACCESS} sw-tabs`)).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'access-effective-idle');
    await page.locator(`${ACCESS} sw-button`).filter({ hasText: 'חשב' }).click();
    await atViews(page, 'access-effective');

    await bootPeople(page, '/system/access?tab=audit');
    await expect(page.locator(`${ACCESS} sw-table`)).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'access-audit');

    await bootPeople(page, '/system/access?tab=local');
    await expect(page.locator(`${ACCESS} system-local-users [data-local-users]`)).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'local-users');
    await page.locator(`${ACCESS} system-local-users`).getByText('מריה כהן').first().click();
    await atViews(page, 'local-user-detail');
    await page.locator(`${ACCESS} system-local-users [data-local-add]`).click();
    await atViews(page, 'local-user-add');
  });

  // ---------- הגדרות › בקרת כניסה (sub-panels) ----------

  test('access control sub-panels: status, audit, groups, policy, messages', async ({ page }) => {
    const PANEL = 'sw-app system-access-control';
    for (const [hash, name, ready] of [
      ['/system/access-control', 'ac-status', `${PANEL} system-access-status [data-access-status="ready"]`],
      ['/system/access-control/audit', 'ac-audit', `${PANEL} system-access-audit [data-access-audit-table]`],
      ['/system/access-control/groups', 'ac-groups', `${PANEL} system-access-groups`],
      ['/system/access-control/policy', 'ac-policy', `${PANEL} system-access-policy`],
    ] as const) {
      await installAccessMock(page, { persona: 'admin' });
      await page.clock.setFixedTime(NOW);
      await page.goto('about:blank');
      await page.goto(url(hash));
      await expect(page.locator(ready).first()).toBeVisible({ timeout: 30_000 });
      await atViews(page, name);
      if (name === 'ac-status') {
        const st = page.locator(`${PANEL} system-access-status [data-access-station]`).first();
        if (await st.count()) {
          await st.click();
          await atViews(page, 'ac-health');
        }
      }
    }
    await installMessagingSettings(page, { persona: 'admin' });
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto(url('/system/access-control/messaging'));
    await expect(page.locator(`${PANEL} system-access-messaging [data-access-status="ready"]`)).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'ac-messaging');
  });

  test('diagnostics: parity and display cards', async ({ page }) => {
    const mock = await installAccessMock(page, { persona: 'admin' });
    await installParityMock(page, mock, 'ready');
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto(url('/system/diagnostics?tab=access-control'));
    await expect(page.locator('sw-app system-access-display').first()).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'diag-parity-display');
  });

  // ---------- WisKey › גישה חיצונית ----------

  test('external access', async ({ page }) => {
    await installRequestMock(page, {});
    await page.clock.setFixedTime(XNOW);
    await page.goto('about:blank');
    await page.goto(url('/wiskey/external'));
    await expect(page.locator('sw-app access-external-screen .kpis').first()).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'external');
    await installRequestMock(page, { empty: true });
    await page.goto('about:blank');
    await page.goto(url('/wiskey/external'));
    await expect(page.locator('sw-app access-external-screen .kpis').first()).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'external-empty');
  });

  // ---------- הגדרות › אפליקציה לנייד › מקומות ----------

  test('presence places', async ({ page }) => {
    const SETTINGS = {
      enabled: true, mode: 'continuous', interval_s: 60, distance_filter_m: 50, notice_text: 'הודעה', notice_version: 2, sensors_allowed: ['location', 'beacon'], intervals_s: {},
      sites: [{ id: 'site_main', name: 'המשרד', lat: 32.08, lon: 34.78, radius_m: 150 }],
      beacons: [{ id: 'bcn_lobby', name: 'לובי', uuid: 'f7826da6-4fa2-4e98-8024-bc5b71e0893e', major: 1, minor: 2, site_id: 'site_main', floor_id: 'f2', zone_id: null }],
      wifi_sites: [{ id: 'wifi_f3', name: 'קומה 3', site_id: 'site_main', floor_id: 'f3', ssid_hash_salt: 'abcdef0123456789', ssid_hashes: ['a'.repeat(64)] }],
      retention_days: 30, required_sensors: { enabled: false, sensors: [], apply_to_web: false, max_stale_hours: 48, roles: [], users: [], exempt_users: [] }, break_glass: { until: null, reason: '', by: null },
      people: { stale_minutes: 30, beacon_max_age_minutes: 10, wifi_max_age_minutes: 15, min_proximity: 'near', show_names: true, refresh_seconds: 30 }, people_opt_out_count: 2,
    };
    const PERMS = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'system.configure', 'presence.report', 'presence.sensors.view', 'presence.view'];
    await page.route('**/api/v1/**', async (route) => {
      const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (p === 'me') return json({ channel: 'local', remote: null, user: { id: 'u-admin', username: 'u-admin', display_name: 'מנהלת', source: 'ingress' }, active: true, bindings: [], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full' });
      if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
      if (p === 'presence/settings') return json({ settings: SETTINGS, sensors: [], devices: 3 });
      if (p === 'presence/devices') return json({ devices: [] });
      if (p.startsWith('floors/') && p.endsWith('/zones')) return json({ zones: [] });
      if (p === 'sites') return json({ sites: TREE, can_create_site: false });
      if (p === 'settings') return json({ settings: { 'ui.design': 'a' }, can_edit: true });
      if (p === 'health/summary') return json({ status: 'ok', items: [], checked_at: '2026-10-05T00:00:00Z', version: 'test' });
      if (p.startsWith('rules/alerts')) return json({ alerts: [], unacked: 0 });
      return json({ code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: '', details: {} }, 404);
    });
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/diagnostics?tab=mobile&page=places');
    await expect(page.locator('system-presence system-presence-places')).toBeVisible({ timeout: 30_000 });
    await atViews(page, 'presence-places');
  });
});
