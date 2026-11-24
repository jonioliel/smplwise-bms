import { expect, type Page, type Route } from '@playwright/test';

// MFA-SCREENS-2510: one mocked backend for the second-factor screens (evidence-mfa-screens-2510.spec.ts, pixel-mfa-screens-2510.spec.ts):
// the wire contracts of smplwise/routers/second_factor.py, local_passkeys.py, device_keys.py, access_tokens.py, factor_policy.py,
// user_factors.py, settings and the users directory. Invented users and values only - no secret, no real code, no address.

export const GOOD = '246810';
export const GOOD_RECOVERY = 'H4TW-2PRB';
export const GOOD_SIGNATURE = 'c2lnLW9r';
const PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign', 'identity.directory.read'];
const READER_PERMS = ['video.live', 'map.read', 'access.read', 'devices.read', 'events.read', 'rbac.assign'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (code: string, msg: string, details: Record<string, unknown> = {}) => ({ code, user_message: msg, retryable: false, correlation_id: 'mock', details });

const person = (user_id: string, name: string, kind: 'ha' | 'local', reason: string, factor: string | null = null) => ({ user_id, name, kind, reason, factor });
const MISSING_ALL = [
  person('u-ron', 'רון לוי', 'ha', 'global'),
  person('u-maya', 'מאיה אברהם', 'ha', 'global'),
  person('u-guard', 'עמדת שמירה ראשית', 'local', 'global'),
];

/** The compliance view the mocked server answers for a policy (stored or previewed). */
function compliance(policy: string) {
  const exempt = [person('u-wall', 'פנל לובי', 'ha', 'wall', null)];
  if (policy === 'optional') return { policy, users_total: 6, covered: 0, enrolled: 0, missing_count: 0, missing: [], exempt_count: 1, exempt, ha_mfa_seen: 1, legacy_required: 0 };
  if (policy === 'admins') return { policy, users_total: 6, covered: 2, enrolled: 1, missing_count: 1, missing: [MISSING_ALL[0]], exempt_count: 1, exempt, ha_mfa_seen: 1, legacy_required: 0 };
  return { policy, users_total: 6, covered: 5, enrolled: 2, missing_count: 3, missing: MISSING_ALL, exempt_count: 1, exempt, ha_mfa_seen: 1, legacy_required: 0 };
}

const user = (id: string, name: string, username: string, isSelf = false) => ({
  id, name, username, is_admin: isSelf, active: true, source: 'both', sync_status: 'verified', synced_at: '2026-11-20T08:00:00Z', first_seen_at: null, last_seen_at: null,
  groups: [], bindings: [], is_self: isSelf, remote_access: true, remote_access_basis: 'flag', remote_last_sign_in: null, remote_sessions: 0,
});

interface DeviceKey {
  id: string;
  label: string;
  auth_kind: 'biometric' | 'biometric_or_screen_lock';
  attested: 'hardware' | 'software' | 'none' | 'failed' | 'not_checked';
  counts: boolean;
}

interface Mock {
  calls: { method: string; path: string; body: unknown }[];
  settings: Record<string, unknown>;
  deviceKeys: DeviceKey[];
  proof: boolean;
  /** user id -> factors of the drawer */
  factors: Record<string, { totp: boolean; passkeys: number; device_keys: number; recovery: number }>;
  enrolled: Set<string>;
  reader: boolean;
  /** the step-up methods the gate's 403 lists (the shell dialog offers what it can of them) */
  methods: string[];
  verifies: Record<string, unknown>[];
  /** RELEASE-2510-TRAIN: the reset preflight's refusal (`last_admin`, `rate_limited`, ...); undefined = allowed */
  resetRefusal?: 'self' | 'user_unknown' | 'local_only' | 'last_admin' | 'rate_limited';
}

const USERNAMES: Record<string, string> = { 'u-admin': 'admin', 'u-dana': 'dana', 'u-ron': 'ron', 'u-maya': 'maya' };

export async function installMfaMock(page: Page, over: Partial<Pick<Mock, 'settings' | 'reader' | 'methods' | 'resetRefusal'>> = {}): Promise<Mock> {
  const st: Mock = {
    calls: [],
    settings: { 'ui.design': 'a', 'security.factor_policy': 'admins', 'security.factor_policy_mode': 'report', 'security.factor_wall_exempt': 'on', 'security.remote_long_lived_tokens': 'allow', 'security.step_up': 'off', 'security.step_up_minutes': 5, 'security.step_up_local': 'off', ...(over.settings ?? {}) },
    deviceKeys: [
      { id: 'dk_pixel000000000000001', label: 'Pixel 8 של דנה', auth_kind: 'biometric', attested: 'hardware', counts: true },
      { id: 'dk_tablet00000000000002', label: 'טאבלט בכניסה', auth_kind: 'biometric_or_screen_lock', attested: 'software', counts: true },
    ],
    proof: false,
    factors: {
      'u-dana': { totp: true, passkeys: 1, device_keys: 2, recovery: 7 },
      'u-ron': { totp: false, passkeys: 2, device_keys: 0, recovery: 0 },
      'u-maya': { totp: false, passkeys: 0, device_keys: 0, recovery: 0 },
    },
    enrolled: new Set(['u-dana']),
    reader: over.reader ?? false,
    resetRefusal: over.resetRefusal,
    methods: over.methods ?? ['totp'],
    verifies: [],
  };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = null;
    }
    if (p.startsWith('auth/') || p.startsWith('security/') || (p === 'settings' && method === 'PATCH')) st.calls.push({ method, path: p + url.search, body });
    const perms = st.reader ? READER_PERMS : PERMS;
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings' && method === 'PATCH') {
      if (st.settings['security.step_up'] === 'on' && !st.proof)
        return json(route, err('step_up_required', 'לפני שינוי הגדרות, משתמשים או הרשאות צריך לאשר שוב את הזהות.', { action: 'system.configure', methods: st.methods, minutes: 5, verify_path: 'auth/step-up/verify' }), 403);
      st.settings = { ...st.settings, ...(body as Record<string, unknown>) };
      return json(route, { settings: st.settings, can_edit: true });
    }
    if (p === 'settings') return json(route, { settings: st.settings, can_edit: !st.reader });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-24T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'auth/sessions') return json(route, { scope: 'own', can_manage: false, channel: 'local', sessions: [] });
    // the users directory (Settings › Users & permissions)
    if (p === 'identity/users') return json(route, { users: [user('u-admin', 'מנהל', 'admin', true), user('u-dana', 'דנה כהן', 'dana'), user('u-ron', 'רון לוי', 'ron'), user('u-maya', 'מאיה אברהם', 'maya')], directory: { paired: true, last_directory_at: null, users: 4 }, revision: 1, can_assign: true, remote_policy: 'flag' });
    if (p === 'access/roles') return json(route, { roles: [], labels: {}, sensitive: [] });
    if (p === 'access/groups') return json(route, { groups: [], can_manage: true, delegated: false });
    const alarmUser = p.match(/^alarm\/users\/([^/]+)$/);
    if (alarmUser && method === 'GET') return json(route, { user_id: decodeURIComponent(alarmUser[1]), arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: false, pin_set_at: null, pin_set_by: null, code_mode: 'personal_pin' });
    // my own factors
    if (p === 'auth/second-factor' && method === 'GET') return json(route, { enabled: true, enabled_at: '2026-11-01T08:00:00Z', last_used_at: '2026-11-24T07:00:00Z' });
    if (p === 'auth/recovery-codes' && method === 'GET') return json(route, { available: true, remaining: 3, total: 10, created_at: '2026-11-01T08:00:00Z', last_used_at: '2026-11-20T08:00:00Z', low: true, low_at: 3 });
    if (p === 'auth/passkeys' && method === 'GET')
      return json(route, { available: true, rp_id: url.hostname, origin: url.origin, first_allowed: false, first_on: false, only_on: false, only_effective: false,
        credentials: [{ id: 'pk1', label: 'MacBook', created_at: '2026-11-02T08:00:00+00:00', last_used_at: null, synced: true, backed_up: true, transports: ['internal'], usable: true, user_verifying: true }],
        recent_auth: false, recent_auth_left_s: 0, totp: true, user_kind: 'user' });
    if (p === 'auth/tokens' && method === 'GET')
      return json(route, { ha_listed: true, ha_reason: null, app_enabled: true, tokens: [
        { id: 'ha_0123456789abcdef0123', source: 'ha', kind: 'long_lived', name: 'Node-RED', client: null, created_at: '2026-09-29T08:00:00Z', last_used_at: '2026-11-24T06:00:00Z', expires_at: null, current: false, revocable: false, used_in_arx: false, arx_first_seen_at: null, arx_last_seen_at: null, arx_address: null, arx_agent: null },
      ] });
    if (p === 'auth/device-keys' && method === 'GET')
      return json(route, { keys: st.deviceKeys.map((k) => ({ ...k, platform: 'android', created_at: '2026-11-10T08:00:00Z', last_used_at: k.attested === 'hardware' ? '2026-11-24T06:30:00Z' : null })), auth_kind: 'biometric_or_screen_lock', attestation: 'preferred', max: 5 });
    const dk = p.match(/^auth\/device-keys\/(.+)$/);
    if (dk && method === 'DELETE') {
      if (!st.proof) return json(route, err('step_up_required', 'לפני ביטול מפתח טלפון צריך לאשר שוב את הזהות.', { action: 'auth.device_key.revoke', methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' }), 403);
      const id = decodeURIComponent(dk[1]);
      st.deviceKeys = st.deviceKeys.filter((k) => k.id !== id);
      return json(route, { id, revoked: true });
    }
    if (p === 'auth/step-up' && method === 'GET')
      return json(route, { enabled: st.settings['security.step_up'] === 'on', minutes: 5, local_channel: false, applies: st.settings['security.step_up'] === 'on', reason: st.settings['security.step_up'] === 'on' ? null : 'off', methods: ['totp'], valid_until: st.proof ? '2026-11-24T10:05:00+00:00' : null });
    if (p === 'auth/device-keys/challenge' && method === 'POST')
      return json(route, { challenge_id: 'dkc_mock1', purpose: 'step_up', payload: 'arx-device-key|step_up|mock', expires_in: 60, auth_kind: 'biometric_or_screen_lock', allowed_auth_kinds: ['biometric', 'biometric_or_screen_lock'], attestation: 'preferred' });
    if (p === 'auth/step-up/verify' && method === 'POST') {
      const b = (body ?? {}) as { method?: string; code?: string; signature?: string; challenge_id?: string; key_id?: string };
      st.verifies.push(b);
      const ok = b.method === 'recovery_code' ? b.code === GOOD_RECOVERY : b.method === 'device_key' ? b.signature === GOOD_SIGNATURE && b.challenge_id === 'dkc_mock1' : b.code === GOOD;
      if (!ok) return json(route, err('second_factor_invalid', 'קוד האימות אינו נכון.'), 400);
      st.proof = true;
      return json(route, { method: b.method ?? 'totp', minutes: 5, valid_until: '2026-11-24T10:05:00+00:00' });
    }
    // the policy tab
    if (p === 'security/factor-policy' && method === 'GET') {
      const stored = String(st.settings['security.factor_policy']);
      const preview = url.searchParams.get('policy');
      return json(route, { policy: stored, mode: st.settings['security.factor_policy_mode'], enforced: st.settings['security.factor_policy_mode'] === 'enforce', wall_exempt: st.settings['security.factor_wall_exempt'] !== 'off',
        long_lived_tokens: st.settings['security.remote_long_lived_tokens'], legacy: { second_factor_policy: 'optional', require_mfa_admin: false }, overrides: { user: {}, role: {} }, compliance: compliance(preview ?? stored) });
    }
    // the user drawer
    const uf = p.match(/^security\/user-factors\/(.+)$/);
    if (uf && method === 'GET') {
      const id = decodeURIComponent(uf[1]);
      const f = st.factors[id] ?? { totp: false, passkeys: 0, device_keys: 0, recovery: 0 };
      const required = id === 'u-ron' || id === 'u-maya';
      return json(route, { user_id: id, totp: { enabled: f.totp, enabled_at: f.totp ? '2026-11-01T08:00:00Z' : null, last_used_at: null }, passkeys: f.passkeys, passkeys_usable: f.passkeys,
        device_keys: f.device_keys, device_keys_counting: f.device_keys, recovery: { remaining: f.recovery, total: f.recovery ? 10 : 0, low: f.recovery > 0 && f.recovery <= 3 },
        ha_mfa_seen: id === 'u-dana', policy: { sign_in: required ? 'required' : 'optional', source: 'global', enforced: false } });
    }
    if (p === 'auth/second-factor/users' && method === 'GET')
      return json(route, { policy: 'optional', users: [...st.enrolled].map((id) => ({ user_id: id, enabled_at: '2026-11-01T08:00:00Z', last_used_at: null })) });
    if (p === 'auth/second-factor/overrides' && method === 'GET') return json(route, { policy: 'optional', user: {}, role: {} });
    // RELEASE-2510-TRAIN (MFA-RESET-HARDENING-2510): the reset's preflight and the typed username; `resetRefusal` makes the preflight say no
    const chk = p.match(/^auth\/second-factor\/users\/([^/]+)\/reset-check$/);
    if (chk && method === 'GET') {
      const id = decodeURIComponent(chk[1]);
      const f = st.factors[id] ?? { totp: false, passkeys: 0, device_keys: 0, recovery: 0 };
      return json(route, { user_id: id, allowed: !st.resetRefusal, reason: st.resetRefusal ?? null, confirm_text: USERNAMES[id] ?? id, channel: 'any', remote: false, resets_left: 3, rate_max: 3,
        factors: { totp: f.totp, passkeys: f.passkeys, device_keys: f.device_keys, recovery_codes: f.recovery }, must_enroll_after: id === 'u-ron' || id === 'u-maya',
        step_up: { action: 'auth.second_factor.reset', methods: ['totp'], minutes: 0, once: true, verify_path: 'auth/step-up/verify' } });
    }
    const del = p.match(/^auth\/second-factor\/users\/(.+)$/);
    if (del && method === 'DELETE') {
      const id = decodeURIComponent(del[1]);
      if (((body as { confirm?: string } | null)?.confirm ?? '').trim().toLowerCase() !== (USERNAMES[id] ?? id)) return json(route, err('factor_reset_confirm_mismatch', 'שם המשתמש שהוקלד אינו תואם לחשבון. האיפוס לא בוצע.', { field: 'confirm' }), 422);
      st.enrolled.delete(id);
      st.factors[id] = { totp: false, passkeys: 0, device_keys: 0, recovery: 0 };
      return json(route, { user_id: id, removed: true, totp: false, passkeys: 2, device_keys: 0, recovery_codes: 0 });
    }
    return json(route, err('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return st;
}

export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 860;

/** החשבון שלי › אבטחה, open. */
export async function openSecurity(page: Page) {
  await page.goto('/?design=a#/system/access'); // a page this mock serves (the users list), not an error state behind the menu
  await page.waitForSelector('sw-app');
  await page.locator(isPhone(page) ? 'sw-app [data-nav-me]' : 'sw-app [data-profile-menu]').click();
  const menu = page.locator('sw-app sw-user-menu [data-profile-menu-panel]');
  await expect(menu).toBeVisible();
  await menu.locator('[data-menu-account]').click();
  await menu.locator('[data-my-security] summary').click();
  const sec = menu.locator('[data-my-security] sw-account-security');
  await expect(sec.locator('[data-sec-overview]')).toBeVisible();
  return { menu, sec };
}

/** הגדרות › משתמשים והרשאות › אימות דו־שלבי. */
export async function openPolicyTab(page: Page) {
  await page.goto('/?design=a#/system/access?tab=factor');
  await page.waitForSelector('sw-app system-access');
  const tab = page.locator('sw-app system-access sw-factor-policy-admin');
  await expect(tab.locator('[data-fp-admin]')).toBeVisible();
  return tab;
}

/** The user drawer of one user. */
export async function openUserDrawer(page: Page, name: string) {
  await page.goto('/?design=a#/system/access');
  await page.waitForSelector('sw-app system-access');
  const screen = page.locator('sw-app system-access');
  await screen.locator('sw-table tbody tr', { hasText: name }).first().click();
  const drawer = screen.locator('sw-drawer[data-user-drawer]');
  await expect(drawer).toBeVisible();
  return drawer;
}
